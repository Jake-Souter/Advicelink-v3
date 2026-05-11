import type { Assets } from './assets.js';
import type { Beneficiaries } from './beneficiaries.js';
import { CONCESSIONAL_TYPES, NON_CONCESSIONAL_TYPES, type Contributions } from './contributions.js';
import type { Financial } from './financial.js';
import { type Insurance, isIpCover } from './insurance.js';
import type { Personal } from './personal.js';
import { FREQUENCY_PER_YEAR, type Frequency } from './primitives.js';
import {
  DEFAULT_RISK_PROFILE_SCORING_MAP,
  RISK_PROFILE_QUESTION_KEYS,
  type RiskProfile,
  type RiskProfileBand,
  type RiskProfileScoringMap,
} from './riskProfile.js';

/**
 * Server-side derivation helpers for the Fact Find sections.
 *
 * Per WP-6 design choice: derived fields are computed on the server
 * at save time and persisted into the JSONB column. The frontend
 * never recomputes — it reads what the API returned. This buys two
 * properties:
 *
 *  1. The SOA template can read derived fields directly from the row
 *     without re-evaluating arithmetic in the docx renderer.
 *  2. The audit log captures the exact derived values that informed a
 *     transition (`lockFactFind` snapshots the row), which would be
 *     impossible if derivations lived on the client.
 *
 * Every derive function is pure — no I/O, no `Date.now()`, no
 * randomness. They are safe to call from the projection sandbox in
 * WP-9 if needed.
 */

const TWO_DP = (n: number): number => Math.round(n * 100) / 100;

/**
 * BMI = weight (kg) / (height (m))². Returns `undefined` when
 * either input is missing rather than `null` so the JSONB shape
 * stays clean when serialised.
 */
export function deriveBmi(personal: Personal): number | undefined {
  if (personal.height == null || personal.weight == null) return undefined;
  if (personal.height <= 0) return undefined;
  const heightM = personal.height / 100;
  return TWO_DP(personal.weight / (heightM * heightM));
}

export function derivePersonal(personal: Personal): Personal {
  const bmi = deriveBmi(personal);
  return { ...personal, bmi };
}

/**
 * For each income row, populate `superGuaranteeDollars` and aggregate
 * `totalIncomeAnnual` + `totalSgAnnual` at the section level. Income
 * rows themselves are passed through unchanged in shape so the UI's
 * `id` references stay stable across saves.
 */
export function deriveFinancial(financial: Financial): Financial {
  let totalIncomeAnnual = 0;
  let totalSgAnnual = 0;
  const incomes = financial.incomes.map((income) => {
    totalIncomeAnnual += income.grossAnnual;
    if (income.sgEligible && income.superGuaranteePercent != null) {
      const sgDollars = TWO_DP((income.grossAnnual * income.superGuaranteePercent) / 100);
      totalSgAnnual += sgDollars;
      return { ...income, superGuaranteeDollars: sgDollars };
    }
    // Strip a stale superGuaranteeDollars if sgEligible was just turned off.
    const { superGuaranteeDollars: _drop, ...rest } = income;
    void _drop;
    return rest;
  });
  return {
    ...financial,
    incomes,
    totalIncomeAnnual: TWO_DP(totalIncomeAnnual),
    totalSgAnnual: TWO_DP(totalSgAnnual),
  };
}

/**
 * Sums `totalAssets` and `totalLiabilities` across the unified asset
 * row list. Standalone debts (credit cards, personal loans) are
 * captured as rows with `assetValue=0` and `amountOwing>0`; they
 * contribute to `totalLiabilities` but not `totalAssets`.
 */
export function deriveAssets(assets: Assets): Assets {
  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const item of assets.items) {
    totalAssets += item.assetValue;
    totalLiabilities += item.amountOwing;
  }
  return {
    ...assets,
    totalAssets: TWO_DP(totalAssets),
    totalLiabilities: TWO_DP(totalLiabilities),
  };
}

/**
 * Lift a frequency-bearing amount to an annual figure. Used for both
 * insurance premiums and contribution items.
 */
export function annualise(amount: number, frequency: Frequency): number {
  return TWO_DP(amount * FREQUENCY_PER_YEAR[frequency]);
}

/**
 * Contributions: split items by tax treatment and total. SG mirror
 * is wired by `deriveAll` (it needs the financial section to read
 * the figure from), so this helper leaves `totalSgAnnual` alone.
 */
export function deriveContributions(contributions: Contributions): Contributions {
  let totalConcessional = 0;
  let totalNonConcessional = 0;
  for (const item of contributions.items) {
    const annual = annualise(item.amount, item.frequency);
    if ((CONCESSIONAL_TYPES as readonly string[]).includes(item.type)) {
      totalConcessional += annual;
    } else if ((NON_CONCESSIONAL_TYPES as readonly string[]).includes(item.type)) {
      totalNonConcessional += annual;
    }
  }
  return {
    ...contributions,
    totalConcessional: TWO_DP(totalConcessional),
    totalNonConcessional: TWO_DP(totalNonConcessional),
  };
}

/**
 * Insurance: annualise each cover's premium, then split totals by
 * payee. Covers without a premium (mid-edit) contribute zero.
 */
export function deriveInsurance(insurance: Insurance): Insurance {
  let totalSuperPremium = 0;
  let totalPersonalPremium = 0;
  const covers = insurance.covers.map((cover) => {
    if (cover.premium == null || cover.premiumFrequency == null) {
      // Drop a stale annualPremium if the user just cleared the inputs.
      const { annualPremium: _drop, ...rest } = cover;
      void _drop;
      return rest;
    }
    const annualPremium = annualise(cover.premium, cover.premiumFrequency);
    if (cover.payee === 'Super') {
      totalSuperPremium += annualPremium;
    } else if (cover.payee === 'Self') {
      totalPersonalPremium += annualPremium;
    }
    return { ...cover, annualPremium };
  });
  return {
    ...insurance,
    covers,
    totalSuperPremium: TWO_DP(totalSuperPremium),
    totalPersonalPremium: TWO_DP(totalPersonalPremium),
  };
}

/**
 * Beneficiaries: this section currently has nothing to derive at
 * row level — the per-policy sum invariant is enforced by the
 * Zod superRefine. Helper exists so `deriveAll` can apply a
 * uniform pipeline.
 */
export function deriveBeneficiaries(beneficiaries: Beneficiaries): Beneficiaries {
  return beneficiaries;
}

/**
 * Risk profile: sum the five answer-key scores, then look up the
 * band. Unknown answer keys score zero (visible in the UI as a low
 * score → low band) rather than throwing, because mid-edit the user
 * may have tabbed away with one question still empty.
 */
export function deriveRiskProfile(
  riskProfile: RiskProfile,
  scoringMap: RiskProfileScoringMap = DEFAULT_RISK_PROFILE_SCORING_MAP,
): RiskProfile {
  let total = 0;
  let answered = 0;
  for (const key of RISK_PROFILE_QUESTION_KEYS) {
    const answer = riskProfile[key];
    if (typeof answer !== 'string' || answer.length === 0) continue;
    answered += 1;
    const value = scoringMap.questions[key][answer];
    if (typeof value === 'number') total += value;
  }
  const out: RiskProfile = { ...riskProfile, riskScore: total };
  // Only assign a band when all five questions are answered AND the
  // total falls inside a defined band — otherwise drop the band so
  // partial UI doesn't display a stale Defensive/Conservative
  // misclassification.
  if (answered === RISK_PROFILE_QUESTION_KEYS.length) {
    const band: RiskProfileBand | undefined = scoringMap.bands.find(
      (b) => total >= b.minInclusive && total <= b.maxInclusive,
    )?.band;
    if (band) out.riskProfile = band;
    else delete out.riskProfile;
  } else {
    delete out.riskProfile;
  }
  return out;
}

/**
 * Orchestrator. Applied by the service layer (WP-6.3) on every
 * `factFind.upsertSection` call before the row is persisted.
 *
 * Order matters: financial must run before contributions (so the
 * SG figure is fresh when `contributions.totalSgAnnual` is mirrored),
 * and personal can run independently.
 */
export interface DeriveAllInput {
  personal: Personal;
  financial: Financial;
  assets: Assets;
  contributions: Contributions;
  insurance: Insurance;
  beneficiaries: Beneficiaries;
  riskProfile: RiskProfile;
}
export type DeriveAllOutput = DeriveAllInput;

export function deriveAll(input: DeriveAllInput): DeriveAllOutput {
  const personal = derivePersonal(input.personal);
  const financial = deriveFinancial(input.financial);
  const assets = deriveAssets(input.assets);
  const insurance = deriveInsurance(input.insurance);
  const beneficiaries = deriveBeneficiaries(input.beneficiaries);
  const riskProfile = deriveRiskProfile(input.riskProfile);
  // Mirror SG figure into contributions, then derive its own totals.
  const contributionsWithSgMirror = {
    ...input.contributions,
    totalSgAnnual: financial.totalSgAnnual,
  };
  const contributions = deriveContributions(contributionsWithSgMirror);
  return {
    personal,
    financial,
    assets,
    contributions,
    insurance,
    beneficiaries,
    riskProfile,
  };
}

/** Convenience: net wealth = totalAssets - all amounts owing across the unified asset list. */
export function deriveNetWealth(assets: Assets): number {
  const a = assets.totalAssets ?? 0;
  const l = assets.totalLiabilities ?? 0;
  return TWO_DP(a - l);
}

/**
 * Insurance utility kept for the SOA template and the IP-cover
 * page; surfaced as a named export so the template renderer can
 * import without depending on the full `derivations` module.
 */
export function isIpCoverType(type: string): boolean {
  return isIpCover(type as Parameters<typeof isIpCover>[0]);
}
