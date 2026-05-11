import { z } from 'zod';

import { isoDateSchema, percentageSchema, uuidSchema } from './primitives.js';

/**
 * Beneficiaries (REBUILD_PLAN §7.5.8).
 *
 * Each row nominates a beneficiary on a fund or policy with a
 * percentage allocation. The `sum-per-policy = 100` invariant is the
 * only non-trivial constraint and lives on the array itself rather
 * than on the individual rows so the user can freely edit a row
 * mid-form without the schema screaming.
 *
 * The lock-fact-find checker (WP-6.3) will additionally enforce that
 * every fund referenced in `superannuation.currentFunds` either has
 * its own beneficiary set or carries a `nominationDeclined` flag —
 * but that's cross-section validation that belongs on the service,
 * not this single-section schema.
 */

export const bindingTypeSchema = z.enum(['Binding', 'Non-binding']);
export const lapsingTypeSchema = z.enum(['Lapsing', 'Non-lapsing']);

export const beneficiaryItemSchema = z
  .object({
    id: uuidSchema,
    fundOrPolicy: z.string().trim().min(1).max(200),
    firstName: z.string().trim().min(1).max(100).optional(),
    middleName: z.string().trim().max(100).optional(),
    surname: z.string().trim().min(1).max(100).optional(),
    dateOfBirth: isoDateSchema.optional(),
    percentage: percentageSchema,
    bindingType: bindingTypeSchema.optional(),
    lapsingType: lapsingTypeSchema.optional(),
  })
  .strict();
export type BeneficiaryItem = z.infer<typeof beneficiaryItemSchema>;

export const beneficiariesSchema = z
  .object({
    items: z.array(beneficiaryItemSchema).max(50).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    /**
     * Sum percentages per fund-or-policy and reject anything that
     * goes over 100. We deliberately do NOT require == 100 here —
     * the user may be mid-edit between two beneficiaries on a single
     * fund (e.g. moved 60% off Alice, hasn't yet given it to Bob).
     * The lock check enforces == 100 at fact-find lock time.
     *
     * Float comparison uses a 0.01% epsilon — allocations can carry
     * a 2 dp percentage so 99.99 + 0.02 should be flagged but
     * 99.999 should not.
     */
    const totals = new Map<string, number>();
    for (const item of value.items) {
      const previous = totals.get(item.fundOrPolicy) ?? 0;
      totals.set(item.fundOrPolicy, previous + item.percentage);
    }
    for (const [fundOrPolicy, total] of totals) {
      if (total > 100.0001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: `Beneficiary allocations for "${fundOrPolicy}" exceed 100% (got ${total.toFixed(2)}%)`,
        });
      }
    }
  });

export type Beneficiaries = z.infer<typeof beneficiariesSchema>;
export const beneficiariesDefault: Beneficiaries = beneficiariesSchema.parse({ items: [] });
