import { z } from 'zod';

import { insuranceCoverSchema } from './insurance.js';
import { moneySchema, percentageSchema, uuidSchema } from './primitives.js';
import { riskProfileBandSchema } from './riskProfile.js';

/**
 * Recommendations (REBUILD_PLAN §7.5.11).
 *
 * Section-level summary only — the line-by-line recommendation rows
 * for each strategy live under `clients.soa_wizard_data` and
 * `clients.roa_eo_wizard_data`. This shape captures the output the
 * SOA template needs at the section header level + the data the
 * projection engine snapshots on advice presentation.
 *
 * `amendmentsRecommendedInsurance.covers` is populated only when the
 * adviser opens the ROA / EO Wizard; it is empty `[]` for new
 * clients.
 */

export const rolloverTypeSchema = z.enum(['Full', 'Partial', 'Consolidate', 'No Rollover']);

export const rolloverItemSchema = z
  .object({
    id: uuidSchema,
    rolloverType: rolloverTypeSchema,
    fromFundId: uuidSchema.optional(),
    toFundId: uuidSchema.optional(),
    amount: moneySchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type RolloverItem = z.infer<typeof rolloverItemSchema>;

export const insuranceImportanceSchema = z.enum(['Low', 'Medium', 'High', 'Critical']);

export const recommendedInsuranceCoverSchema = insuranceCoverSchema.and(
  z.object({
    recommendation: z.string().max(2000).optional(),
    importance: insuranceImportanceSchema.optional(),
  }),
);
export type RecommendedInsuranceCover = z.infer<typeof recommendedInsuranceCoverSchema>;

export const platformPortfolioSchema = z
  .object({
    portfolioType: z.string().trim().max(100).optional(),
    riskProfile: riskProfileBandSchema.optional(),
    portfolioId: z.string().trim().max(100).optional(),
  })
  .strict();

export const portfolioFeesSchema = z
  .object({
    investmentFeePercent: percentageSchema.optional(),
    administrationFeePercent: percentageSchema.optional(),
    administrationFeeFixed: moneySchema.optional(),
    transactionCostsPercent: percentageSchema.optional(),
    indirectCostsPercent: percentageSchema.optional(),
  })
  .strict();

export const likeForLikePortfolioSchema = z
  .object({
    fundName: z.string().trim().max(200).optional(),
    investmentOption: z.string().trim().max(200).optional(),
    fees: portfolioFeesSchema.optional(),
  })
  .strict();

export const currentPortfolioSchema = z
  .object({
    performanceRange: z.string().trim().max(200).optional(),
    grossReturn: percentageSchema.optional(),
    fees: portfolioFeesSchema.optional(),
    derived: z.record(z.unknown()).optional(),
  })
  .strict();

export const recommendationsSchema = z
  .object({
    rolloverStrategy: z
      .object({ items: z.array(rolloverItemSchema).max(20).default([]) })
      .strict()
      .default({ items: [] }),
    recommendedInsurance: z
      .object({ covers: z.array(recommendedInsuranceCoverSchema).max(30).default([]) })
      .strict()
      .default({ covers: [] }),
    amendmentsRecommendedInsurance: z
      .object({ covers: z.array(recommendedInsuranceCoverSchema).max(30).default([]) })
      .strict()
      .default({ covers: [] }),
    platformPortfolio: platformPortfolioSchema.optional(),
    likeForLikePortfolio: likeForLikePortfolioSchema.optional(),
    currentPortfolio: currentPortfolioSchema.optional(),
    notes: z.string().max(8000).optional(),
  })
  .strict();

export type Recommendations = z.infer<typeof recommendationsSchema>;
export const recommendationsDefault: Recommendations = recommendationsSchema.parse({});
