import { z } from 'zod';

import { frequencySchema, moneySchema, uuidSchema } from './primitives.js';

/**
 * Insurance (REBUILD_PLAN §7.5.7).
 *
 * Each cover is one of five types. The schema models the four
 * non-IP covers and the IP cover with a single discriminated union
 * via `superRefine` rather than a `z.discriminatedUnion` so the row
 * shape stays mostly-optional during autosave (the user can flip
 * `coverType` and the previously-required fields would become
 * incompatible mid-edit).
 *
 * `annualPremium` and the section-level totals are derived (see
 * `derivations.deriveInsurance`).
 *
 *   coverType ∈ {Life, TPD, Trauma}
 *     → coverAmount required, monthlyBenefit forbidden, IP fields forbidden
 *   coverType ∈ {IP, 'Income Protection'}        // legacy alias
 *     → monthlyBenefit required, coverAmount forbidden,
 *       waitingPeriod + benefitPeriod required
 *   coverType = TPD additionally allows `definition` + `structure`
 */

export const coverTypeSchema = z.enum(['Life', 'TPD', 'Trauma', 'IP', 'Income Protection']);
export type CoverType = z.infer<typeof coverTypeSchema>;

export const tpdDefinitionSchema = z.enum(['Any Occ', 'Own Occ']);
export const tpdStructureSchema = z.enum(['Standalone', 'Linked']);
export const premiumTypeSchema = z.enum(['Stepped', 'Level', 'Hybrid']);
export const payeeSchema = z.enum(['Self', 'Super']);

const ipCoverTypes: readonly CoverType[] = ['IP', 'Income Protection'];
export function isIpCover(type: CoverType): boolean {
  return (ipCoverTypes as readonly string[]).includes(type);
}

/**
 * Waiting & benefit periods are stored as free strings (e.g. "30 days",
 * "2 years", "to age 65") because insurers carry an open set; we
 * normalise to days/months in the projection engine, not here.
 */
const periodStringSchema = z.string().trim().max(60);

export const insuranceCoverSchema = z
  .object({
    id: uuidSchema,
    coverType: coverTypeSchema,

    /** For Life / TPD / Trauma. */
    coverAmount: moneySchema.optional(),
    /** For IP / Income Protection. */
    monthlyBenefit: moneySchema.optional(),
    waitingPeriod: periodStringSchema.optional(),
    benefitPeriod: periodStringSchema.optional(),

    /** TPD-only. */
    definition: tpdDefinitionSchema.optional(),
    structure: tpdStructureSchema.optional(),

    premium: moneySchema.optional(),
    premiumFrequency: frequencySchema.optional(),
    /** Derived from `premium` * frequency multiplier. */
    annualPremium: moneySchema.optional(),

    payee: payeeSchema.optional(),
    insurer: z.string().trim().max(200).optional(),
    medicallyUnderwritten: z.boolean().optional(),
    premiumType: premiumTypeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ip = isIpCover(value.coverType);
    if (ip) {
      if (value.coverAmount != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['coverAmount'],
          message: 'IP / Income Protection covers use monthlyBenefit, not coverAmount',
        });
      }
    } else {
      if (value.monthlyBenefit != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['monthlyBenefit'],
          message: 'Only IP / Income Protection covers use monthlyBenefit',
        });
      }
      if (value.waitingPeriod != null || value.benefitPeriod != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: value.waitingPeriod != null ? ['waitingPeriod'] : ['benefitPeriod'],
          message: 'waitingPeriod / benefitPeriod only apply to IP covers',
        });
      }
    }
    if (value.coverType !== 'TPD') {
      if (value.definition != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definition'],
          message: 'definition only applies to TPD covers',
        });
      }
      if (value.structure != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['structure'],
          message: 'structure only applies to TPD covers',
        });
      }
    }
    if (value.premium != null && value.premiumFrequency == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['premiumFrequency'],
        message: 'premiumFrequency is required when premium is set',
      });
    }
  });
export type InsuranceCover = z.infer<typeof insuranceCoverSchema>;

export const insuranceSchema = z
  .object({
    /** Derived; sum of `covers[].annualPremium` where payee = Super. */
    totalSuperPremium: moneySchema.optional(),
    /** Derived; sum of `covers[].annualPremium` where payee = Self. */
    totalPersonalPremium: moneySchema.optional(),
    covers: z.array(insuranceCoverSchema).max(30).default([]),
  })
  .strict();

export type Insurance = z.infer<typeof insuranceSchema>;
export const insuranceDefault: Insurance = insuranceSchema.parse({ covers: [] });
