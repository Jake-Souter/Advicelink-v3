import { z } from 'zod';

import { frequencySchema, isoDateSchema, moneySchema, uuidSchema } from './primitives.js';

/**
 * Contributions (REBUILD_PLAN §7.5.6).
 *
 * Two derivations live on this section:
 *  - `totalConcessional`     — Salary Sacrifice + Personal Concessional
 *  - `totalNonConcessional`  — Non-concessional + Spouse + Government Co-contribution
 *
 * The contribution caps (concessional cap, non-concessional cap,
 * bring-forward windows) are evaluated against these totals by the
 * projection / recommendation engine in WP-9; this section just
 * captures the raw items.
 *
 * `totalSgAnnual` is mirrored from `financial.totalSgAnnual` at save
 * time — the derivations layer fans out the income side once and
 * caches the figure here so the downstream "concessional headroom"
 * math is a one-table read.
 */

export const contributionTypeSchema = z.enum([
  'Salary Sacrifice',
  'Personal Concessional',
  'Non-concessional',
  'Spouse',
  'Government Co-contribution',
]);
export type ContributionType = z.infer<typeof contributionTypeSchema>;

export const CONCESSIONAL_TYPES: readonly ContributionType[] = [
  'Salary Sacrifice',
  'Personal Concessional',
];
export const NON_CONCESSIONAL_TYPES: readonly ContributionType[] = [
  'Non-concessional',
  'Spouse',
  'Government Co-contribution',
];

export function isConcessional(type: ContributionType): boolean {
  return (CONCESSIONAL_TYPES as readonly string[]).includes(type);
}

export const contributionItemSchema = z
  .object({
    id: uuidSchema,
    type: contributionTypeSchema,
    amount: moneySchema.default(0),
    frequency: frequencySchema,
    /** Fund id from `superannuation.currentFunds`. */
    destination: uuidSchema.optional(),
    lastReceived: isoDateSchema.optional(),
    /** Notice of Intent — only relevant for Personal Concessional. */
    noiSubmitted: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.noiSubmitted && value.type !== 'Personal Concessional') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['noiSubmitted'],
        message: 'Notice of Intent only applies to Personal Concessional contributions',
      });
    }
  });
export type ContributionItem = z.infer<typeof contributionItemSchema>;

export const contributionsSchema = z
  .object({
    /** Mirrored from `financial.totalSgAnnual` by the derivations layer. */
    totalSgAnnual: moneySchema.optional(),
    sgDestination: uuidSchema.optional(),
    sgFrequency: frequencySchema.optional(),
    sgLastReceived: isoDateSchema.optional(),

    items: z.array(contributionItemSchema).max(20).default([]),

    /** Derived. */
    totalConcessional: moneySchema.optional(),
    /** Derived. */
    totalNonConcessional: moneySchema.optional(),
  })
  .strict();

export type Contributions = z.infer<typeof contributionsSchema>;
export const contributionsDefault: Contributions = contributionsSchema.parse({ items: [] });
