import { z } from 'zod';

import {
  frequencySchema,
  investmentRecommendationActionSchema,
  longText,
  moneySchema,
  riskProfileBandSchema,
  shortText,
  uuidSchema,
} from './primitives.js';

/**
 * §19.1.9 `investmentRecommendations` — outside-super investment advice.
 *
 * Free-form ESG block kept as long text rather than a tag list because
 * the production team's ESG vocabulary changes per licensee; the SOA
 * template renders it verbatim.
 */
export const investmentOngoingContributionSchema = z
  .object({
    amount: moneySchema.optional(),
    frequency: frequencySchema.optional(),
  })
  .strict();
export type InvestmentOngoingContribution = z.infer<typeof investmentOngoingContributionSchema>;

export const investmentRecommendationsSchema = z
  .object({
    outsideSuperRecommendation: investmentRecommendationActionSchema.optional(),
    /** FK to recommended portfolio (§10.6). */
    preferredPlatformId: uuidSchema.optional(),
    preferredPortfolioRiskProfile: riskProfileBandSchema.optional(),
    initialInvestmentAmount: moneySchema.optional(),
    ongoingContribution: investmentOngoingContributionSchema.optional(),
    esgPreferences: longText.optional(),
    rationale: longText.optional(),
    /** Optional — adviser may quote alternatives considered. */
    alternativesNotes: longText.optional(),
    /** Optional — short tag for the chosen platform (display-only). */
    preferredPlatformLabel: shortText.optional(),
  })
  .strict();

export type InvestmentRecommendations = z.infer<typeof investmentRecommendationsSchema>;
export const investmentRecommendationsDefault: InvestmentRecommendations =
  investmentRecommendationsSchema.parse({});
