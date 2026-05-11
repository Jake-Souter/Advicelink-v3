import { z } from 'zod';

import {
  coverTypeSchema,
  longText,
  moneySchema,
  recommendedPremiumTypeSchema,
  recommendedStructureSchema,
  shortText,
  tpdDefinitionSchema,
  uuidSchema,
} from './primitives.js';

/**
 * §19.1.7 `insuranceRecommendations`.
 *
 * One row per cover type the adviser is recommending. `currentCover`
 * mirrors the matching row from `clients.insurance.covers` (looked up
 * by coverType when `refreshFromFactFind` runs); `calculatedNeed` comes
 * from the needs-analysis engine (REBUILD_PLAN §19.7); `recommendedCover`
 * is the adviser-final number.
 *
 * AI assist is wired against `perCover[*].rationale`
 * (`promptKey: soaWizardInsuranceRationale`).
 */
export const insuranceProviderShortlistEntrySchema = z
  .object({
    insurer: shortText,
    indicativePremium: moneySchema.optional(),
    /** 'omnilife' = quote pulled from the OmniLife adapter (§9.6); 'manual' = adviser entered. */
    source: z.enum(['omnilife', 'manual']),
  })
  .strict();
export type InsuranceProviderShortlistEntry = z.infer<typeof insuranceProviderShortlistEntrySchema>;

export const insurancePerCoverSchema = z
  .object({
    id: uuidSchema,
    coverType: coverTypeSchema,
    currentCover: moneySchema.optional(),
    calculatedNeed: moneySchema.optional(),
    recommendedCover: moneySchema.optional(),
    recommendedStructure: recommendedStructureSchema.optional(),
    /** TPD only. */
    recommendedDefinition: tpdDefinitionSchema.optional(),
    /** IP only — free text e.g. "30 days". */
    recommendedWaitingPeriod: shortText.optional(),
    /** IP only — free text e.g. "to age 65". */
    recommendedBenefitPeriod: shortText.optional(),
    recommendedPremiumType: recommendedPremiumTypeSchema.optional(),
    providerShortlist: z.array(insuranceProviderShortlistEntrySchema).max(10).default([]),
    preferredProvider: shortText.optional(),
    rationale: longText.optional(),
    alternatives: longText.optional(),
  })
  .strict();
export type InsurancePerCover = z.infer<typeof insurancePerCoverSchema>;

export const insuranceRecommendationsSchema = z
  .object({
    context: longText.optional(),
    /** FK to insurance-settings version used for the calculatedNeed run. */
    needsAnalysisVersionId: shortText.optional(),
    perCover: z.array(insurancePerCoverSchema).max(10).default([]),
  })
  .strict();

export type InsuranceRecommendations = z.infer<typeof insuranceRecommendationsSchema>;
export const insuranceRecommendationsDefault: InsuranceRecommendations =
  insuranceRecommendationsSchema.parse({});
