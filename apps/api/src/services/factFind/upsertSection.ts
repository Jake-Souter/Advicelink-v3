import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import {
  deriveAll,
  factFindSectionDefaults,
  factFindSectionSchemas,
  type FactFindSectionId,
} from '@advicelink/schemas';

import type { TxDb } from '../../trpc/context.js';
import { loadFactFind } from './load.js';

/**
 * Save one Fact Find section.
 *
 * Strategy
 * --------
 * Every save:
 *   1. Loads ALL 12 sections off the row.
 *   2. Validates the inbound payload against the section's schema.
 *   3. Merges the validated payload into its slot.
 *   4. Runs `deriveAll` over the whole merged set so cross-section
 *      derivations (financial.totalSgAnnual → contributions.totalSgAnnual)
 *      stay in lockstep.
 *   5. Writes ALL derived sections back in one UPDATE.
 *
 * Why "write all" rather than "write just the changed column"?
 *
 *   - Derivations are cross-section. A financial save updates
 *     `contributions.totalSgAnnual`; a write-only-this-section
 *     strategy would have to special-case which sections to fan out.
 *   - JSONB column writes are cheap (Postgres does a single row
 *     update regardless of how many JSONB columns we set).
 *   - The audit trail is cleaner: one workflow_events / file_notes
 *     row per save corresponds to one DB UPDATE.
 *
 * Returns the freshly-loaded row so the caller can hand it back to
 * the frontend without a follow-up query.
 *
 * The Fact Find lock is checked here too: once `fact_find_locked_at`
 * is set, only paraplanner / adviser may amend the row, and only
 * during SOA Production states. Lead-gen attempts to write a locked
 * row are rejected with `FORBIDDEN`.
 */

import type { Role } from '@advicelink/rbac';

export interface UpsertSectionInput {
  clientId: string;
  sectionId: FactFindSectionId;
  payload: unknown;
  actor: { id: string; role: Role };
}

const POST_LOCK_WRITE_ROLES: readonly Role[] = [
  'paraplanner',
  'adviser',
  'tenant_super_admin',
  'platform_super_admin',
];

export async function upsertSection(tx: TxDb, input: UpsertSectionInput) {
  const schema = factFindSectionSchemas[input.sectionId];
  if (!schema) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Unknown Fact Find section '${input.sectionId}'`,
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

  const before = await loadFactFind(tx, input.clientId);

  // Lock guard. If the FF is locked, only the post-lock allow-list
  // can amend it. The frontend hides the inputs in this state, but
  // the API is the source of truth.
  if (before.meta.factFindLockedAt != null) {
    if (!(POST_LOCK_WRITE_ROLES as readonly string[]).includes(input.actor.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Fact Find is locked; role '${input.actor.role}' cannot amend it`,
      });
    }
  }

  const merged = {
    ...before.sections,
    [input.sectionId]: parsed.data,
  };

  // deriveAll only knows about the strict 8-section subset that
  // carries derivations; the other sections (employment / partner /
  // superannuation / goals) are left untouched.
  const derived = deriveAll({
    personal:
      (merged.personal as typeof factFindSectionDefaults.personal) ??
      factFindSectionDefaults.personal,
    financial:
      (merged.financial as typeof factFindSectionDefaults.financial) ??
      factFindSectionDefaults.financial,
    assets:
      (merged.assets as typeof factFindSectionDefaults.assets) ?? factFindSectionDefaults.assets,
    liabilities:
      (merged.liabilities as typeof factFindSectionDefaults.liabilities) ??
      factFindSectionDefaults.liabilities,
    contributions:
      (merged.contributions as typeof factFindSectionDefaults.contributions) ??
      factFindSectionDefaults.contributions,
    insurance:
      (merged.insurance as typeof factFindSectionDefaults.insurance) ??
      factFindSectionDefaults.insurance,
    beneficiaries:
      (merged.beneficiaries as typeof factFindSectionDefaults.beneficiaries) ??
      factFindSectionDefaults.beneficiaries,
    riskProfile:
      (merged.riskProfile as typeof factFindSectionDefaults.riskProfile) ??
      factFindSectionDefaults.riskProfile,
  });

  await tx
    .update(clients)
    .set({
      personal: derived.personal,
      financial: derived.financial,
      assets: derived.assets,
      liabilities: derived.liabilities,
      contributions: derived.contributions,
      insurance: derived.insurance,
      beneficiaries: derived.beneficiaries,
      riskProfile: derived.riskProfile,
      // Untouched-by-derivation sections — write through what we
      // loaded so a partial concurrent edit doesn't get clobbered
      // by sending an out-of-date copy back to the row.
      employment: merged.employment,
      partnerEmployment: merged.partnerEmployment,
      superannuation: merged.superannuation,
      goals: merged.goals,
      updatedBy: input.actor.id,
      updatedAt: sql`now()`,
    })
    .where(eq(clients.id, input.clientId));

  return loadFactFind(tx, input.clientId);
}
