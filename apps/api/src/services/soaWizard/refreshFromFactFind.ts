import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import {
  factFindSectionDefaults,
  factFindSectionSchemas,
  soaWizard as soaWizardSchemas,
  type Assets,
  type Financial,
  type Insurance,
  type RiskProfile as FactFindRiskProfile,
  type Superannuation,
} from '@advicelink/schemas';
import type { Role } from '@advicelink/rbac';
import { isAdviceRole, isAtLeastTenantAdmin } from '@advicelink/rbac';

import type { TxDb } from '../../trpc/context.js';
import { loadSoaWizard } from './load.js';

/**
 * Re-pull the SOA Wizard's `position` snapshot from the locked Fact
 * Find. REBUILD_PLAN §19.1.4: the wizard's `position` section
 * auto-populates on first open and is re-pullable via a
 * "Refresh from Fact Find" button.
 *
 * The shape of `position` is owned by `@advicelink/schemas/soaWizard`;
 * this helper just gathers the inputs from the right Fact Find
 * sections and runs them through the section's own Zod schema so
 * the persisted blob is always schema-valid.
 *
 * Adviser commentary on `observations` is preserved across refresh:
 * we don't want a re-pull to wipe a paragraph the adviser just
 * typed. Same logic for `household.weeklyExpensesEstimate` (a manual
 * entry) and any future adviser-overrideable field.
 */

const TWO_DP = (n: number): number => Math.round(n * 100) / 100;

export interface RefreshFromFactFindInput {
  clientId: string;
  actor: { id: string; role: Role };
}

function assertActorMayRefresh(role: Role): void {
  if (isAtLeastTenantAdmin(role)) return;
  if (isAdviceRole(role)) return; // paraplanner / adviser / ar_adviser
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `Role '${role}' may not refresh the SOA Wizard from the Fact Find`,
  });
}

function parseSection<T>(
  schemaKey: keyof typeof factFindSectionSchemas,
  raw: unknown,
  defaultValue: T,
): T {
  const schema = factFindSectionSchemas[schemaKey];
  const result = schema.safeParse(raw ?? defaultValue);
  return result.success ? (result.data as T) : defaultValue;
}

export async function refreshFromFactFind(tx: TxDb, input: RefreshFromFactFindInput) {
  assertActorMayRefresh(input.actor.role);

  const before = await loadSoaWizard(tx, input.clientId);
  if (before.meta.factFindLockedAt == null) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Cannot refresh SOA Wizard from Fact Find: the Fact Find has not been locked yet.',
    });
  }

  // Pull the Fact Find sections we need straight from the row. We
  // already have `before` from the wizard load, but we need the
  // separate Fact Find columns rather than the wizard blob.
  const [row] = await tx.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${input.clientId} not found` });
  }

  const financial = parseSection<Financial>(
    'financial',
    row.financial,
    factFindSectionDefaults.financial,
  );
  const assets = parseSection<Assets>('assets', row.assets, factFindSectionDefaults.assets);
  const superannuation = parseSection<Superannuation>(
    'superannuation',
    row.superannuation,
    factFindSectionDefaults.superannuation,
  );
  const insurance = parseSection<Insurance>(
    'insurance',
    row.insurance,
    factFindSectionDefaults.insurance,
  );
  const riskProfile = parseSection<FactFindRiskProfile>(
    'riskProfile',
    row.riskProfile,
    factFindSectionDefaults.riskProfile,
  );

  // ── Compute the snapshot numbers ───────────────────────────────
  const totalAssets = assets.totalAssets ?? 0;
  const totalLiabilities = assets.totalLiabilities ?? 0;
  const netWealth = TWO_DP(totalAssets - totalLiabilities);

  const totalSuper = TWO_DP(
    superannuation.currentFunds.reduce((sum, fund) => sum + (fund.currentBalance ?? 0), 0),
  );

  const totalIncomeAnnual = financial.totalIncomeAnnual ?? 0;
  const totalSgAnnual = financial.totalSgAnnual ?? 0;

  // Insurance summary: lift the Fact Find's per-cover totals into
  // the four headline numbers the SOA's "Your Current Position"
  // table renders. IP rows store monthlyBenefit not coverAmount.
  let totalSumInsuredLife = 0;
  let totalSumInsuredTpd = 0;
  let totalIpMonthlyBenefit = 0;
  for (const cover of insurance.covers) {
    if (cover.coverType === 'Life' && cover.coverAmount != null) {
      totalSumInsuredLife += cover.coverAmount;
    } else if (cover.coverType === 'TPD' && cover.coverAmount != null) {
      totalSumInsuredTpd += cover.coverAmount;
    } else if (
      (cover.coverType === 'IP' || cover.coverType === 'Income Protection') &&
      cover.monthlyBenefit != null
    ) {
      totalIpMonthlyBenefit += cover.monthlyBenefit;
    }
  }
  const totalAnnualPremium = TWO_DP(
    (insurance.totalSuperPremium ?? 0) + (insurance.totalPersonalPremium ?? 0),
  );

  // ── Preserve adviser-supplied bits ─────────────────────────────
  const previousPosition = before.sections.position as
    | soaWizardSchemas.Position
    | undefined;
  const previousObservations = previousPosition?.observations;
  const previousWeeklyExpensesEstimate = previousPosition?.household?.weeklyExpensesEstimate;

  // ── Build the new position section ─────────────────────────────
  const newPosition: soaWizardSchemas.Position = {
    household: {
      netWealth,
      totalSuper,
      totalIncomeAnnual: TWO_DP(totalIncomeAnnual),
      totalSgAnnual: TWO_DP(totalSgAnnual),
      ...(previousWeeklyExpensesEstimate != null
        ? { weeklyExpensesEstimate: previousWeeklyExpensesEstimate }
        : {}),
    },
    insuranceSummary: {
      totalSumInsuredLife: TWO_DP(totalSumInsuredLife),
      totalSumInsuredTpd: TWO_DP(totalSumInsuredTpd),
      totalIpMonthlyBenefit: TWO_DP(totalIpMonthlyBenefit),
      totalAnnualPremium,
    },
    ...(riskProfile.riskProfile
      ? // The Fact Find's `riskProfile.riskProfile` band uses the same
        // five-label vocabulary as the SOA Wizard's
        // `riskProfileBandSchema` — but we still cast through the SOA
        // Wizard's parser at the end so any future drift is caught.
        { riskProfileLabel: riskProfile.riskProfile as soaWizardSchemas.RiskProfileBand }
      : {}),
    ...(previousObservations ? { observations: previousObservations } : {}),
  };

  // Validate the new position through its Zod schema before persist.
  // Anything we computed above is already in-range, but the parse
  // also strips unknown keys and applies any defaults.
  const positionParsed = soaWizardSchemas.positionSchema.safeParse(newPosition);
  if (!positionParsed.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Refreshed position payload failed schema validation',
      cause: positionParsed.error,
    });
  }

  // Merge the new position back into the wizard blob without
  // touching the other 14 sections.
  const merged: Record<string, unknown> = {
    ...before.sections,
    position: positionParsed.data,
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
