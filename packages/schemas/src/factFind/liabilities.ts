import { z } from 'zod';

import { assetItemSchema } from './assets.js';
import { moneySchema } from './primitives.js';

/**
 * Liabilities — same row shape as `assets.items` (REBUILD_PLAN §7.5.4).
 *
 * The shared shape lets the UI render one combined "Wealth & Debt"
 * grid while the backend keeps liabilities-only rows (e.g. an
 * unsecured personal loan with no backing asset) in their own column.
 * The derivations layer treats the two columns symmetrically when
 * computing net wealth.
 */

export const liabilityItemSchema = assetItemSchema;
export type LiabilityItem = z.infer<typeof liabilityItemSchema>;

export const liabilitiesSchema = z
  .object({
    items: z.array(liabilityItemSchema).max(50).default([]),
    /** Derived; sum of `items[].amountOwing`. */
    totalLiabilities: moneySchema.optional(),
  })
  .strict();

export type Liabilities = z.infer<typeof liabilitiesSchema>;
export const liabilitiesDefault: Liabilities = liabilitiesSchema.parse({ items: [] });
