import { z } from 'zod';

import { frequencySchema, longText, moneySchema, shortText, uuidSchema } from './primitives.js';

/**
 * §19.1.12 `feesCosts` — the SOA's mandatory fee-disclosure section.
 *
 * Everything labelled "derived" is computed by the service layer at
 * save time and rendered read-only in the editor. `productFees`
 * mirrors the recommended portfolio's published fee schedule (§10.6);
 * `insurancePremiumsAnnualised` mirrors the insuranceRecommendations
 * total. The two grand totals (`totalFirstYearCost`,
 * `totalOngoingCostPerYear`) are simple sums but kept on the row so
 * the DOCX template can emit them with a `{soaWizard.feesCosts.*}`
 * token rather than re-running arithmetic.
 */
export const feesCostsLineItemSchema = z
  .object({
    amount: moneySchema.optional(),
    gstApplicable: z.boolean().optional(),
    frequency: frequencySchema.optional(),
  })
  .strict();
export type FeesCostsLineItem = z.infer<typeof feesCostsLineItemSchema>;

export const productFeeRowSchema = z
  .object({
    id: uuidSchema,
    feeName: shortText,
    /** Free-text so the row can carry "$50 / year" or "0.85% pa" without a discriminator. */
    amountOrPercent: shortText,
    /** 'asset-based' | 'flat' | 'transactional' — kept open as text. */
    basis: shortText.optional(),
  })
  .strict();
export type ProductFeeRow = z.infer<typeof productFeeRowSchema>;

export const feesCostsSchema = z
  .object({
    initialAdviceFee: feesCostsLineItemSchema.optional(),
    ongoingAdviceFee: feesCostsLineItemSchema.optional(),
    implementationFee: feesCostsLineItemSchema.optional(),
    productFees: z.array(productFeeRowSchema).max(40).default([]),
    insurancePremiumsAnnualised: moneySchema.optional(),
    /** Derived. */
    totalFirstYearCost: moneySchema.optional(),
    /** Derived. */
    totalOngoingCostPerYear: moneySchema.optional(),
    feesDisclosureStatement: longText.optional(),
  })
  .strict();

export type FeesCosts = z.infer<typeof feesCostsSchema>;
export const feesCostsDefault: FeesCosts = feesCostsSchema.parse({});
