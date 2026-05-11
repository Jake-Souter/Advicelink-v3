import { z } from 'zod';

import { longText, moneySchema, riskProfileBandSchema } from './primitives.js';

/**
 * §19.1.4 `position` — snapshot of the client's current position.
 *
 * Auto-populated from the locked Fact Find on first wizard open by
 * `refreshFromFactFind` (service layer); the adviser can re-pull on
 * demand via the "Refresh from Fact Find" button. The household /
 * insuranceSummary objects are optional only because a freshly-saved
 * draft may not yet have visited the refresh path; once the Fact
 * Find is locked these are always populated by the server.
 *
 * `observations` is adviser commentary and is the only AI-assistable
 * field on this section (`promptKey: soaWizardPositionObservations`).
 */

export const positionHouseholdSchema = z
  .object({
    netWealth: moneySchema.optional(),
    totalSuper: moneySchema.optional(),
    totalIncomeAnnual: moneySchema.optional(),
    totalSgAnnual: moneySchema.optional(),
    /** Optional adviser entry — Fact Find doesn't capture this directly. */
    weeklyExpensesEstimate: moneySchema.optional(),
  })
  .strict();
export type PositionHousehold = z.infer<typeof positionHouseholdSchema>;

export const positionInsuranceSummarySchema = z
  .object({
    totalSumInsuredLife: moneySchema.optional(),
    totalSumInsuredTpd: moneySchema.optional(),
    totalIpMonthlyBenefit: moneySchema.optional(),
    totalAnnualPremium: moneySchema.optional(),
  })
  .strict();
export type PositionInsuranceSummary = z.infer<typeof positionInsuranceSummarySchema>;

export const positionSchema = z
  .object({
    household: positionHouseholdSchema.optional(),
    riskProfileLabel: riskProfileBandSchema.optional(),
    insuranceSummary: positionInsuranceSummarySchema.optional(),
    observations: longText.optional(),
  })
  .strict();

export type Position = z.infer<typeof positionSchema>;
export const positionDefault: Position = positionSchema.parse({});
