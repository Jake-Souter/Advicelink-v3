import { z } from 'zod';

import {
  longText,
  moneySchema,
  shortText,
  superRecommendationActionSchema,
  uuidSchema,
} from './primitives.js';
import { percentageSchema } from '../factFind/primitives.js';

/**
 * §19.1.8 `superRecommendations`.
 *
 * `recommendation` drives the rest: 'Retain current' hides the
 * to-fund / rollover-notes block; 'Consolidate' / 'Switch' / 'Open new'
 * all surface them. The schema doesn't enforce the cross-field rule
 * — the wizard UI hides irrelevant inputs and the finalise gate is
 * downstream.
 *
 * `feeComparison` is server-derived from the recommended portfolio +
 * current funds; the editor renders it read-only.
 *
 * AI assist: `rationale` (`promptKey: soaWizardSuperRationale`).
 */
export const superContributionStrategySchema = z
  .object({
    salaryPackagedAmountAnnual: moneySchema.optional(),
    personalConcessionalAmountAnnual: moneySchema.optional(),
    nonConcessionalAmountAnnual: moneySchema.optional(),
    spouseContribution: moneySchema.optional(),
    coContributionTarget: moneySchema.optional(),
  })
  .strict();
export type SuperContributionStrategy = z.infer<typeof superContributionStrategySchema>;

export const superFeeComparisonSchema = z
  .object({
    currentTotalFeesPercent: percentageSchema.optional(),
    recommendedTotalFeesPercent: percentageSchema.optional(),
    annualSavingsAtCurrentBalance: moneySchema.optional(),
  })
  .strict();
export type SuperFeeComparison = z.infer<typeof superFeeComparisonSchema>;

export const superRecommendationsSchema = z
  .object({
    recommendation: superRecommendationActionSchema.optional(),
    /** ids from `superannuation.currentFunds` (Fact Find) — typically uuids,
     *  but legacy data sometimes carries free strings, so we accept short text. */
    fromFundIds: z.array(shortText).max(10).default([]),
    /** id of the recommended portfolio (REBUILD_PLAN §10.6). */
    toFundId: uuidSchema.optional(),
    contributionStrategy: superContributionStrategySchema.optional(),
    rolloverNotes: longText.optional(),
    rationale: longText.optional(),
    feeComparison: superFeeComparisonSchema.optional(),
  })
  .strict();

export type SuperRecommendations = z.infer<typeof superRecommendationsSchema>;
export const superRecommendationsDefault: SuperRecommendations =
  superRecommendationsSchema.parse({});
