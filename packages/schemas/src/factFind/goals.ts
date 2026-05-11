import { z } from 'zod';

import { moneySchema } from './primitives.js';

/**
 * Goals (REBUILD_PLAN §7.5.9).
 *
 * Seven free-text questions plus a desired-retirement age and weekly
 * income. The `_locked` map is per-question; setting `_locked.next1To5Years
 * = true` tells the AI assist surface to leave that field alone on
 * re-suggestion. The map default is `{}` (nothing locked).
 *
 * The string limits are generous (4000 chars) because advisers
 * occasionally paste long client-supplied notes — but the SOA template
 * truncates at 1500 with an ellipsis if needed.
 */

const longText = z.string().max(4000);

export const goalsSchema = z
  .object({
    desiredRetirementAge: z.number().int().min(40).max(100).optional(),
    desiredRetirementIncomeWeekly: moneySchema.optional(),

    next12Months: longText.optional(),
    next1To5Years: longText.optional(),
    retirementPlan: longText.optional(),
    superLumpSum: longText.optional(),
    superImportance: longText.optional(),
    insuranceImportance: longText.optional(),
    previousAdviser: longText.optional(),

    /**
     * Per-question manual lock. Keys are any of the question field
     * names above; values are booleans. Open to extension as new
     * AI-assistable questions are added.
     */
    _locked: z.record(z.boolean()).default({}),
  })
  .strict();

export type Goals = z.infer<typeof goalsSchema>;
export const goalsDefault: Goals = goalsSchema.parse({});
