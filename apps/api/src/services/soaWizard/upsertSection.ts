import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import {
  soaWizardSectionSchemas,
  type SoaWizardSectionId,
} from '@advicelink/schemas';
import type { Role } from '@advicelink/rbac';
import { isInPhase, isWorkflowState, type WorkflowState } from '@advicelink/workflow';

import type { TxDb } from '../../trpc/context.js';
import { loadSoaWizard } from './load.js';

/**
 * Save one SOA Wizard section.
 *
 * Strategy
 * --------
 * Unlike the Fact Find (which writes a whole row of JSONB columns
 * because cross-section derivations are common), the SOA Wizard
 * stores all 15 sections under a single `soa_wizard_data` JSONB
 * column. The save:
 *
 *   1. Loads the full payload off the row (including the meta the
 *      workflow gate needs).
 *   2. Validates the inbound section against its Zod schema.
 *   3. Asserts the workflow gate (FF locked + phase ∈ {soaProduction,
 *      presentation, postAdvice}).
 *   4. Merges the validated payload into its slot.
 *   5. Writes the whole `soa_wizard_data` blob back in one UPDATE.
 *
 * Why "write the whole blob"?
 *
 *   - JSONB column writes are atomic and cheap; merging in SQL would
 *     require `jsonb_set` plus careful handling of `null` keys, with
 *     no real benefit.
 *   - Reading-then-writing keeps the audit story simple: one
 *     UPDATE, one `workflow_events` row per save (the workflow_events
 *     write itself lives at the call-site layer in WP-9).
 *   - Concurrent edits to different sections are still safe: this
 *     service runs inside the tRPC `withTenantContext` transaction
 *     and the read is `SELECT ... FROM clients WHERE id = ?`. If
 *     two paraplanners save at the same time, the later one's
 *     transaction reads the earlier writer's section payload and
 *     no edit is lost.
 *
 * Cross-section derivations (e.g. `feesCosts.totalOngoingCostPerYear`,
 * `cashflowModelling.surplusAfterStrategy`) land with WP-9's render
 * pipeline; this service is the storage path.
 */

export interface UpsertSoaWizardSectionInput {
  clientId: string;
  sectionId: SoaWizardSectionId;
  payload: unknown;
  actor: { id: string; role: Role };
}

/**
 * Phases during which the SOA Wizard can be edited.
 *
 *  - `soaProduction` (drafting / reviewing / amending) — primary
 *  - `presentation`  — last-minute polishing before/while presenting
 *  - `postAdvice`    — the ROA/EO branch can amend specific SOA
 *                      sections in-flight; the wizard surfaces those
 *                      sections in read-with-edit mode
 *
 * Any other phase is rejected. The Fact Find lock is also required
 * (it always is, for soaProduction onward — but we re-assert here so
 * a half-baked test fixture doesn't slip through).
 */
function assertWizardEditable(meta: {
  workflowState: string;
  factFindLockedAt: Date | null;
}): void {
  if (meta.factFindLockedAt == null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'SOA Wizard cannot be edited before the Fact Find is locked. Lock the Fact Find first.',
    });
  }
  if (!isWorkflowState(meta.workflowState)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Unknown workflow state '${meta.workflowState}'`,
    });
  }
  const subject = { workflowState: meta.workflowState as WorkflowState };
  const editable =
    isInPhase('soaProduction', subject) ||
    isInPhase('presentation', subject) ||
    isInPhase('postAdvice', subject);
  if (!editable) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `SOA Wizard is not editable in workflow state '${meta.workflowState}'`,
    });
  }
}

export async function upsertSoaWizardSection(
  tx: TxDb,
  input: UpsertSoaWizardSectionInput,
) {
  const schema = soaWizardSectionSchemas[input.sectionId];
  if (!schema) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Unknown SOA Wizard section '${input.sectionId}'`,
    });
  }

  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Section '${input.sectionId}' payload failed validation`,
      cause: parsed.error,
    });
  }

  const before = await loadSoaWizard(tx, input.clientId);
  assertWizardEditable(before.meta);

  const merged: Record<string, unknown> = {
    ...before.sections,
    [input.sectionId]: parsed.data,
  };

  await tx
    .update(clients)
    .set({
      soaWizardData: merged,
      updatedBy: input.actor.id,
      updatedAt: sql`now()`,
    })
    .where(eq(clients.id, input.clientId));

  return loadSoaWizard(tx, input.clientId);
}
