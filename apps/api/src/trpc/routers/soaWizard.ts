import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { clients } from '@advicelink/db';
import {
  SOA_WIZARD_SECTION_IDS,
  soaWizardSectionSchemas,
  type SoaWizardSectionId,
} from '@advicelink/schemas';
import { PROMPT_KEYS, type PromptKey } from '@advicelink/ai';

import { authedProcedure, router } from '../trpc.js';
import type { TxDb } from '../context.js';
import {
  assertCanReadClient,
  assertCanWriteClient,
  type ClientTenancySnapshot,
} from '../../services/clients/access.js';
import { loadSoaWizard } from '../../services/soaWizard/load.js';
import { upsertSoaWizardSection } from '../../services/soaWizard/upsertSection.js';
import { refreshFromFactFind } from '../../services/soaWizard/refreshFromFactFind.js';
import { runAssist } from '../../services/ai/runAssist.js';

/**
 * `soaWizard.*` — every per-section read / write the wizard needs,
 * plus the AI assist hook and the "refresh position from Fact Find"
 * convenience action (REBUILD_PLAN §6.12 / §19.1).
 *
 * Mirrors the Fact Find router's surface area on purpose so the
 * frontend can re-use the same `useDraftSection` save pattern. The
 * gate that forbids edits before the FF is locked lives in
 * `upsertSoaWizardSection` itself.
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
  SOA_WIZARD_SECTION_IDS as unknown as [SoaWizardSectionId, ...SoaWizardSectionId[]],
);

const upsertInput = z.object({
  clientId: z.string().uuid(),
  sectionId: sectionIdSchema,
  payload: z.unknown(),
});

const assistInput = z.object({
  clientId: z.string().uuid(),
  promptKey: z.enum(PROMPT_KEYS as unknown as [PromptKey, ...PromptKey[]]),
  /** Caller-supplied context. The prompt registry's input schema
   *  (in @advicelink/ai) validates the shape inside `runAssist`; we
   *  keep the wire shape `unknown` so a single procedure can serve
   *  every prompt key. */
  input: z.unknown(),
});

const refreshInput = z.object({
  clientId: z.string().uuid(),
});

export const soaWizardRouter = router({
  loadByClientId: authedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await loadClientTenancy(ctx.db, input.clientId);
      assertCanReadClient(row, {
        id: ctx.user.id,
        role: ctx.user.role,
        tenantId: ctx.tenant.id,
      });
      return loadSoaWizard(ctx.db, input.clientId);
    }),

  upsertSection: authedProcedure.input(upsertInput).mutation(async ({ ctx, input }) => {
    const row = await loadClientTenancy(ctx.db, input.clientId);
    assertCanWriteClient(row, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
    if (!(input.sectionId in soaWizardSectionSchemas)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown SOA Wizard sectionId '${input.sectionId}'`,
      });
    }
    const result = await upsertSoaWizardSection(ctx.db, {
      clientId: input.clientId,
      sectionId: input.sectionId,
      payload: input.payload,
      actor: { id: ctx.user.id, role: ctx.user.role },
    });
    ctx.logger.info(
      { clientId: input.clientId, sectionId: input.sectionId },
      'soaWizard.upsertSection',
    );
    return result;
  }),

  refreshFromFactFind: authedProcedure.input(refreshInput).mutation(async ({ ctx, input }) => {
    const row = await loadClientTenancy(ctx.db, input.clientId);
    assertCanWriteClient(row, {
      id: ctx.user.id,
      role: ctx.user.role,
      tenantId: ctx.tenant.id,
    });
    const result = await refreshFromFactFind(ctx.db, {
      clientId: input.clientId,
      actor: { id: ctx.user.id, role: ctx.user.role },
    });
    ctx.logger.info({ clientId: input.clientId }, 'soaWizard.refreshFromFactFind');
    return result;
  }),

  /**
   * AI assist surface for the SOA Wizard. The frontend wires one
   * button per prompt key (e.g. `soaWizardScopeOfAdvice`,
   * `soaWizardStrategyRationale`); every call writes one
   * `ai_invocations` row via `runAssist`.
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
      'soaWizard.aiAssist',
    );
    return result;
  }),
});
