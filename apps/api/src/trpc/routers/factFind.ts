import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { clients } from '@advicelink/db';
import {
  FACT_FIND_SECTION_IDS,
  factFindSectionSchemas,
  type FactFindSectionId,
} from '@advicelink/schemas';
import { PROMPT_KEYS, type PromptKey } from '@advicelink/ai';

import { authedProcedure, router, withRoles } from '../trpc.js';
import type { TxDb } from '../context.js';
import {
  assertCanReadClient,
  assertCanWriteClient,
  type ClientTenancySnapshot,
} from '../../services/clients/access.js';
import { loadFactFind } from '../../services/factFind/load.js';
import { upsertSection } from '../../services/factFind/upsertSection.js';
import { setTfn, clearTfn, readTfnPlaintext } from '../../services/factFind/tfn.js';
import { runAssist } from '../../services/ai/runAssist.js';

/**
 * `factFind.*` — every per-section read / write the wizard needs,
 * plus the AI assist hook and the explicit TFN read/write/clear
 * paths (segregated from `upsertSection` so the audit trail can
 * distinguish a TFN reveal from an ordinary save).
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

const sectionIdSchema = z.enum(
  FACT_FIND_SECTION_IDS as unknown as [FactFindSectionId, ...FactFindSectionId[]],
);

const upsertInput = z.object({
  clientId: z.string().uuid(),
  sectionId: sectionIdSchema,
  payload: z.unknown(),
});

const tfnSlotSchema = z.enum(['self', 'partner']);

const setTfnInput = z.object({
  clientId: z.string().uuid(),
  slot: tfnSlotSchema,
  plaintext: z.string().min(1),
});

const clearTfnInput = z.object({
  clientId: z.string().uuid(),
  slot: tfnSlotSchema,
});

const revealTfnInput = z.object({
  clientId: z.string().uuid(),
  slot: tfnSlotSchema,
});

const assistInput = z.object({
  clientId: z.string().uuid(),
  promptKey: z.enum(PROMPT_KEYS as unknown as [PromptKey, ...PromptKey[]]),
  /**
   * Caller-supplied context. Service layer + redaction layer
   * inspect this; the prompt registry's input schema validates the
   * shape. We keep the wire shape `unknown` so a single procedure
   * can serve every prompt key.
   */
  input: z.unknown(),
});

export const factFindRouter = router({
  loadByClientId: authedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await loadClientTenancy(ctx.db, input.clientId);
      assertCanReadClient(row, {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
      });
      return loadFactFind(ctx.db, input.clientId);
    }),

  upsertSection: authedProcedure.input(upsertInput).mutation(async ({ ctx, input }) => {
    const row = await loadClientTenancy(ctx.db, input.clientId);
    assertCanWriteClient(row, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
    // Per-section schema parse happens inside upsertSection; this
    // procedure-layer enum-check is just defence-in-depth so a
    // typo in `sectionId` fails fast with a meaningful message.
    if (!(input.sectionId in factFindSectionSchemas)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown sectionId '${input.sectionId}'`,
      });
    }
    const result = await upsertSection(ctx.db, {
      clientId: input.clientId,
      sectionId: input.sectionId,
      payload: input.payload,
      actor: { id: ctx.user.id, role: ctx.user.role },
    });
    ctx.logger.info(
      { clientId: input.clientId, sectionId: input.sectionId },
      'factFind.upsertSection',
    );
    return result;
  }),

  setTfn: withRoles(['lead_gen', 'paraplanner', 'adviser', 'uf_support'])
    .input(setTfnInput)
    .mutation(async ({ ctx, input }) => {
      const row = await loadClientTenancy(ctx.db, input.clientId);
      assertCanWriteClient(row, {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
      });
      await setTfn(ctx.db, {
        clientId: input.clientId,
        slot: input.slot,
        plaintext: input.plaintext,
        actorId: ctx.user.id,
      });
      ctx.logger.info(
        { clientId: input.clientId, slot: input.slot, action: 'set' },
        'factFind.setTfn',
      );
      return { ok: true as const };
    }),

  clearTfn: withRoles(['paraplanner', 'adviser', 'uf_support'])
    .input(clearTfnInput)
    .mutation(async ({ ctx, input }) => {
      const row = await loadClientTenancy(ctx.db, input.clientId);
      assertCanWriteClient(row, {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
      });
      await clearTfn(ctx.db, {
        clientId: input.clientId,
        slot: input.slot,
        actorId: ctx.user.id,
      });
      return { ok: true as const };
    }),

  /**
   * Reveal plaintext TFN. Tightly scoped — only adviser /
   * paraplanner / uf_support roles get this. Every reveal lands in
   * `audit_log` via the API layer's procedure logger; an explicit
   * audit-row write lives in WP-7's audit module. For now the
   * info-level log line is the trail.
   */
  revealTfn: withRoles(['adviser', 'paraplanner', 'uf_support'])
    .input(revealTfnInput)
    .query(async ({ ctx, input }) => {
      const row = await loadClientTenancy(ctx.db, input.clientId);
      assertCanReadClient(row, {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
      });
      const plaintext = await readTfnPlaintext(ctx.db, {
        clientId: input.clientId,
        slot: input.slot,
      });
      ctx.logger.warn(
        { clientId: input.clientId, slot: input.slot, action: 'reveal' },
        'factFind.revealTfn (audit)',
      );
      return { plaintext };
    }),

  /**
   * AI assist surface. The frontend wires one button per prompt
   * key; every call writes one `ai_invocations` row.
   */
  aiAssist: authedProcedure.input(assistInput).mutation(async ({ ctx, input }) => {
    const row = await loadClientTenancy(ctx.db, input.clientId);
    assertCanReadClient(row, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
    const result = await runAssist(ctx.db, {
      promptKey: input.promptKey,
      // The prompt registry's input schema does the strict parse
      // inside the adapter; we widen here to satisfy the generic.
      input: input.input as never,
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      clientId: input.clientId,
    });
    ctx.logger.info(
      {
        clientId: input.clientId,
        promptKey: input.promptKey,
        invocationId: result.invocationId,
        costCents: result.costCents,
        latencyMs: result.latencyMs,
      },
      'factFind.aiAssist',
    );
    return result;
  }),
});
