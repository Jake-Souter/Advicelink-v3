import { z } from 'zod';

import {
  frequencySchema,
  isoDateSchema,
  moneySchema,
  percentageSchema,
  uuidSchema,
} from './primitives.js';

/**
 * Assets (and shared item shape with Liabilities — REBUILD_PLAN
 * §7.5.4).
 *
 * The UI co-locates assets and liabilities in one Fact Find section
 * but the persisted shape splits them across two columns
 * (`clients.assets` and `clients.liabilities`) so liability-only rows
 * (a debt with no underlying asset) live cleanly in their own
 * column.
 *
 * Loan fields are optional and only meaningful when `amountOwing > 0`.
 * The schema enforces that `amountOwing > 0 ⇒ loan fields present`
 * during the lock-fact-find check, not here, because mid-edit the
 * user can flip `amountOwing` from 0 to a value before they finish
 * filling in the loan fields.
 */

export const repaymentFrequencySchema = frequencySchema;

export const assetItemSchema = z
  .object({
    id: uuidSchema,
    name: z.string().trim().max(200).optional(),
    assetValue: moneySchema.default(0),
    amountOwing: moneySchema.default(0),
    /** Principal place of residence — flag is referenced by the
     *  projection engine (PPOR is excluded from investable wealth). */
    isPpor: z.boolean().default(false),

    /** Loan fields, optional — see comment above. */
    interestRate: percentageSchema.optional(),
    repaymentAmount: moneySchema.optional(),
    repaymentFrequency: repaymentFrequencySchema.optional(),
    lender: z.string().trim().max(200).optional(),
    loanTermYears: z.number().int().nonnegative().max(60).optional(),
    startDate: isoDateSchema.optional(),
  })
  .strict();
export type AssetItem = z.infer<typeof assetItemSchema>;

export const assetsSchema = z
  .object({
    items: z.array(assetItemSchema).max(50).default([]),
    /** Derived. */
    totalAssets: moneySchema.optional(),
    /** Derived; sum of `items[].amountOwing` (the asset-collateralised
     *  portion of debt). The standalone-debt total lives on
     *  `liabilities.totalLiabilities`. */
    totalLiabilities: moneySchema.optional(),
  })
  .strict();

export type Assets = z.infer<typeof assetsSchema>;
export const assetsDefault: Assets = assetsSchema.parse({ items: [] });
