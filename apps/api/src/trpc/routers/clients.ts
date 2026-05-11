import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { clients } from '@advicelink/db';
import { TRANSITIONS_BY_NAME, type WorkflowTransitionName } from '@advicelink/workflow';
import { personalSchema } from '@advicelink/schemas';

import { authedProcedure, router, withRoles } from '../trpc.js';
import type { TxDb } from '../context.js';
import { createClient } from '../../services/clients/create.js';
import { lockFactFind } from '../../services/clients/lockFactFind.js';
import {
  assertCanReadClient,
  assertCanWriteClient,
  type ClientTenancySnapshot,
} from '../../services/clients/access.js';
import { claimParaplanner, releaseParaplanner } from '../../services/clients/paraplannerClaim.js';
import { executeTransition } from '../../services/workflow/transition.js';
import { listForPortal, type PortalKey } from '../../services/portals/listForPortal.js';

/**
 * `clients.*` — the client lifecycle surface.
 *
 *   create        — both lead-gen and self-source flows
 *   byId          — read-only summary; gated by assertCanReadClient
 *   lockFactFind  — completeness gate + workflow advance
 *   transition    — generic workflow advance (lockFactFind has its
 *                   own dedicated procedure because it carries the
 *                   timestamp side-effect)
 *
 * Per-procedure role allow-lists are intentionally narrow; tenant +
 * platform super-admins are always allowed via `withRoles`.
 */

async function loadClientTenancy(db: TxDb, clientId: string): Promise<ClientTenancySnapshot> {
  const [row] = await db
    .select({
      id: clients.id,
      tenantId: clients.tenantId,
      originatingLeadGenTenantId: clients.originatingLeadGenTenantId,
      destinationAdviceTenantId: clients.destinationAdviceTenantId,
      workflowState: clients.workflowState,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${clientId} not found` });
  }
  return row;
}

const createInput = z.object({
  destinationAdviceTenantId: z.string().uuid().optional(),
  personal: personalSchema,
});

/**
 * `transitionName` is constrained at runtime to a key in the
 * registry rather than typed as a Zod string enum because new
 * transitions show up frequently and a wide enum would explode the
 * exported tRPC type. The runtime guard is sufficient — the workflow
 * service-layer call also re-validates via `getTransition`.
 */
const transitionInput = z.object({
  clientId: z.string().uuid(),
  transitionName: z
    .string()
    .refine((name): name is WorkflowTransitionName => name in TRANSITIONS_BY_NAME, {
      message: 'Unknown workflow transition',
    }),
  reason: z.string().trim().min(1).max(1000).optional(),
  payload: z.record(z.unknown()).optional(),
});

const lockInput = z.object({ clientId: z.string().uuid() });
const byIdInput = z.object({ clientId: z.string().uuid() });
const listInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
  })
  .optional();

const portalKey = z.enum([
  'lead-gen',
  'adviser',
  'paraplanner',
  'uf-support',
  'ar-support',
  'ar-adviser',
] as const satisfies readonly PortalKey[]);
const listForPortalInput = z.object({ portal: portalKey });
const claimInput = z.object({ clientId: z.string().uuid() });
const releaseInput = z.object({
  clientId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const clientsRouter = router({
  create: withRoles(['lead_gen', 'adviser', 'paraplanner', 'uf_support'])
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const created = await createClient(ctx.db, {
        personal: input.personal,
        destinationAdviceTenantId: input.destinationAdviceTenantId,
        actor: { id: ctx.user.id, role: ctx.user.role, tenantId: ctx.tenant.id },
      });
      ctx.logger.info({ clientId: created.id }, 'clients.create');
      return created;
    }),

  /**
   * List the clients visible to the calling actor. Visibility is
   * enforced authoritatively by RLS on the `clients` table — this
   * procedure simply returns whatever the active tenant context
   * makes visible. The select is intentionally narrow (no JSONB
   * sections, no TFN) so the listing query stays cheap.
   */
  list: authedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 50;
    const rows = await ctx.db
      .select({
        id: clients.id,
        displayName: clients.displayName,
        tenantId: clients.tenantId,
        originatingLeadGenTenantId: clients.originatingLeadGenTenantId,
        destinationAdviceTenantId: clients.destinationAdviceTenantId,
        workflowState: clients.workflowState,
        workflowPhase: clients.workflowPhase,
        factFindLockedAt: clients.factFindLockedAt,
        updatedAt: clients.updatedAt,
      })
      .from(clients)
      .orderBy(desc(clients.updatedAt))
      .limit(limit);
    return rows;
  }),

  /**
   * Bucketed view of clients for a given role-specific portal.
   * Defence-in-depth: the service rejects calls from roles that
   * shouldn't see the portal even though `withRoles` filters at the
   * router level too.
   */
  listForPortal: authedProcedure.input(listForPortalInput).query(async ({ ctx, input }) => {
    return listForPortal(ctx.db, input.portal, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
  }),

  /** Paraplanner claim — exclusive lock per client, audit-logged. */
  claimParaplanner: withRoles(['paraplanner'])
    .input(claimInput)
    .mutation(async ({ ctx, input }) => {
      await claimParaplanner(ctx.db, {
        clientId: input.clientId,
        actor: { id: ctx.user.id, role: ctx.user.role, tenantId: ctx.tenant.id },
      });
      ctx.logger.info({ clientId: input.clientId }, 'clients.claimParaplanner');
      return { ok: true } as const;
    }),

  /**
   * Paraplanner release — clears the claim. Self-release is always
   * allowed for the holder; force-release is gated to the assigned
   * adviser or a tenant super-admin (validated in the service).
   */
  releaseParaplanner: withRoles(['paraplanner', 'adviser'])
    .input(releaseInput)
    .mutation(async ({ ctx, input }) => {
      await releaseParaplanner(ctx.db, {
        clientId: input.clientId,
        actor: { id: ctx.user.id, role: ctx.user.role, tenantId: ctx.tenant.id },
        reason: input.reason,
      });
      ctx.logger.info({ clientId: input.clientId }, 'clients.releaseParaplanner');
      return { ok: true } as const;
    }),

  byId: authedProcedure.input(byIdInput).query(async ({ ctx, input }) => {
    const row = await loadClientTenancy(ctx.db, input.clientId);
    assertCanReadClient(row, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
    return row;
  }),

  lockFactFind: withRoles(['lead_gen', 'paraplanner', 'adviser', 'uf_support'])
    .input(lockInput)
    .mutation(async ({ ctx, input }) => {
      const row = await loadClientTenancy(ctx.db, input.clientId);
      assertCanWriteClient(row, {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
      });
      const result = await lockFactFind(ctx.db, {
        clientId: input.clientId,
        actor: { id: ctx.user.id, role: ctx.user.role, tenantId: ctx.tenant.id },
        rowTenantId: row.tenantId,
      });
      ctx.logger.info({ clientId: input.clientId, ...result }, 'clients.lockFactFind');
      return result;
    }),

  transition: authedProcedure.input(transitionInput).mutation(async ({ ctx, input }) => {
    const row = await loadClientTenancy(ctx.db, input.clientId);
    assertCanWriteClient(row, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
    const result = await executeTransition(ctx.db, {
      clientId: input.clientId,
      transitionName: input.transitionName,
      actor: { id: ctx.user.id, role: ctx.user.role, tenantId: ctx.tenant.id },
      reason: input.reason,
      payload: input.payload,
      rowTenantId: row.tenantId,
    });
    ctx.logger.info(
      { clientId: input.clientId, transition: input.transitionName, ...result },
      'clients.transition',
    );
    return result;
  }),
});
