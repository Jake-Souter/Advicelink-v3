import { z } from 'zod';

import {
  frequencySchema,
  longText,
  moneySchema,
  shortText,
  signedMoneySchema,
  uuidSchema,
} from './primitives.js';

/**
 * §19.1.10 `cashflowModelling`.
 *
 * `surplusBeforeStrategy` / `surplusAfterStrategy` are server-derived;
 * the editor renders them read-only. Adjustments are free-form rows
 * the adviser can use to model "drop the gym, redirect to super"
 * style budget shifts; categories are short text rather than an enum
 * so the adviser is never blocked by missing taxonomy.
 *
 * Surpluses use signed money because cashflow can be negative (the
 * proposed strategy may legitimately push the household into deficit
 * if it's funded from existing reserves).
 */
export const cashflowAdjustmentSchema = z
  .object({
    id: uuidSchema,
    category: shortText,
    currentAmount: moneySchema.optional(),
    proposedAmount: moneySchema.optional(),
    frequency: frequencySchema.optional(),
  })
  .strict();
export type CashflowAdjustment = z.infer<typeof cashflowAdjustmentSchema>;

export const cashflowModellingSchema = z
  .object({
    baselineYearlyExpenses: moneySchema.optional(),
    /** Derived. */
    surplusBeforeStrategy: signedMoneySchema.optional(),
    /** Derived. */
    surplusAfterStrategy: signedMoneySchema.optional(),
    budgetAdjustments: z.array(cashflowAdjustmentSchema).max(40).default([]),
    notes: longText.optional(),
  })
  .strict();

export type CashflowModelling = z.infer<typeof cashflowModellingSchema>;
export const cashflowModellingDefault: CashflowModelling = cashflowModellingSchema.parse({});
