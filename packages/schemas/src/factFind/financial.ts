import { z } from 'zod';

import { moneySchema, percentageSchema, uuidSchema } from './primitives.js';

/**
 * Financial / Income section (REBUILD_PLAN §7.5.3).
 *
 * `incomes[].sgEligible` drives whether SG fields are required for
 * that row. SG is the Australian Superannuation Guarantee — only
 * salary-style incomes carry it. Self-employed contractors typically
 * don't and the UI greys the SG inputs out when sgEligible is false.
 *
 * `superGuaranteeDollars` and the section-level totals are derived;
 * the persisted shape carries them so the SOA template doesn't
 * recompute. See `derivations.deriveFinancial`.
 */

export const incomeTypeSchema = z.enum([
  'Salary',
  'Bonus',
  'Self-employed',
  'Investment',
  'Pension',
  'Centrelink',
  'Rental',
  'Other',
]);
export type IncomeType = z.infer<typeof incomeTypeSchema>;

export const incomeItemSchema = z
  .object({
    id: uuidSchema,
    incomeType: incomeTypeSchema,
    grossAnnual: moneySchema,
    sgEligible: z.boolean().default(false),
    /** Default Super Guarantee rate at v1 is 12% (FY2025-26).
     *  The current rate is sourced from a tenant-config setting in
     *  WP-7 admin; here we just enforce the legal range. */
    superGuaranteePercent: percentageSchema.optional(),
    /** Derived = grossAnnual * superGuaranteePercent / 100 when sgEligible. */
    superGuaranteeDollars: moneySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sgEligible && value.superGuaranteePercent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['superGuaranteePercent'],
        message: 'superGuaranteePercent is required when sgEligible is true',
      });
    }
    if (!value.sgEligible && value.superGuaranteePercent != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['superGuaranteePercent'],
        message: 'superGuaranteePercent must be omitted when sgEligible is false',
      });
    }
  });
export type IncomeItem = z.infer<typeof incomeItemSchema>;

export const financialSchema = z
  .object({
    incomes: z.array(incomeItemSchema).max(20).default([]),
    /** Derived. */
    totalIncomeAnnual: moneySchema.optional(),
    /** Derived; equals sum of `incomes[].superGuaranteeDollars` for SG-eligible rows. */
    totalSgAnnual: moneySchema.optional(),
  })
  .strict();

export type Financial = z.infer<typeof financialSchema>;
export const financialDefault: Financial = financialSchema.parse({ incomes: [] });
