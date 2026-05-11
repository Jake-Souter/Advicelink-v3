import { z } from 'zod';

import {
  addressSchema,
  auMobileSchema,
  emailSchema,
  isoDateSchema,
  moneySchema,
  uuidSchema,
  yesNoFormerSchema,
} from './primitives.js';

/**
 * Personal Details — the first Fact Find section. Mirrors
 * REBUILD_PLAN §7.5.1.
 *
 * The TFN is intentionally NOT modelled here. Plaintext TFN flows
 * through a dedicated DTO (`tfnPlaintextSchema`) and is encrypted
 * before reaching the row; the persisted shape on `clients.personal`
 * never contains it. Callers writing to `personal` strip
 * `taxFileNumber` first.
 */

export const titleSchema = z.enum(['Mr', 'Mrs', 'Ms', 'Dr', 'Prof']);
export const genderSchema = z.enum(['Male', 'Female', 'Other', 'Prefer not to say']);
export const maritalStatusSchema = z.enum([
  'Single',
  'Married',
  'De facto',
  'Divorced',
  'Separated',
  'Widowed',
]);
export type MaritalStatus = z.infer<typeof maritalStatusSchema>;

export const PARTNERED_STATUSES: readonly MaritalStatus[] = ['Married', 'De facto'];
export function isPartneredStatus(status: MaritalStatus | undefined | null): boolean {
  return status != null && (PARTNERED_STATUSES as readonly string[]).includes(status);
}

/**
 * Dependants are the only nested array on this section. IDs are
 * client-generated uuids so the form can edit a row before save.
 */
export const dependantSchema = z
  .object({
    id: uuidSchema,
    firstName: z.string().trim().min(1).max(100).optional(),
    surname: z.string().trim().min(1).max(100).optional(),
    dateOfBirth: isoDateSchema.optional(),
  })
  .strict();
export type Dependant = z.infer<typeof dependantSchema>;

const insuranceClaimSchema = z
  .object({
    dateOfClaim: isoDateSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const bankruptcySchema = z
  .object({
    dateOfBankruptcy: isoDateSchema.optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

/**
 * Heights and weights are validated permissively — the real-world
 * range for adults runs 100–250 cm and 30–300 kg; we widen to catch
 * unit-confusion typos (e.g. accidentally typing 1.7 instead of 170)
 * but not so much that derived BMI becomes meaningless.
 */
const heightCmSchema = z.number().finite().min(50).max(260);
const weightKgSchema = z.number().finite().min(20).max(400);

export const personalSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    middleName: z.string().trim().max(100).optional(),
    surname: z.string().trim().min(1).max(100).optional(),
    maidenName: z.string().trim().max(100).optional(),
    title: titleSchema.optional(),
    gender: genderSchema.optional(),
    dateOfBirth: isoDateSchema.optional(),

    mobile: auMobileSchema.optional(),
    email: emailSchema.optional(),

    homeAddress: addressSchema.optional(),
    hasDifferentPostalAddress: z.boolean().optional(),
    postalAddress: addressSchema.nullable().optional(),

    height: heightCmSchema.optional(),
    weight: weightKgSchema.optional(),
    /** Derived; see `derivations.deriveBmi`. Persisted so the SOA template can read it. */
    bmi: z.number().finite().min(5).max(150).optional(),

    smokerStatus: yesNoFormerSchema.optional(),
    healthNotes: z.string().max(4000).optional(),

    maritalStatus: maritalStatusSchema.optional(),
    /** Free text — display-only mirror of partner. Partner employment
     *  detail (employer / occupation) lives on these fields plus the
     *  financial section income rows. */
    partnerName: z.string().trim().max(200).optional(),
    partnerDateOfBirth: isoDateSchema.optional(),
    partnerIncomeAnnual: moneySchema.optional(),

    hasDependants: z.boolean().optional(),
    dependants: z.array(dependantSchema).max(20).default([]),

    qualification: z.string().max(500).optional(),
    nextOfKin: z.string().trim().max(200).optional(),
    nextOfKinContact: z.string().trim().max(200).optional(),

    hasClaimedOnInsurance: z.boolean().optional(),
    insuranceClaim: insuranceClaimSchema.nullable().optional(),

    hasBeenBankrupt: z.boolean().optional(),
    bankruptcy: bankruptcySchema.nullable().optional(),

    hasWill: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.hasDifferentPostalAddress === false && value.postalAddress != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postalAddress'],
        message: 'postalAddress must be null when hasDifferentPostalAddress is false',
      });
    }
    if (value.hasClaimedOnInsurance === false && value.insuranceClaim != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['insuranceClaim'],
        message: 'insuranceClaim must be null when hasClaimedOnInsurance is false',
      });
    }
    if (value.hasBeenBankrupt === false && value.bankruptcy != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bankruptcy'],
        message: 'bankruptcy must be null when hasBeenBankrupt is false',
      });
    }
    if (value.hasDependants === false && value.dependants.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dependants'],
        message: 'dependants must be empty when hasDependants is false',
      });
    }
  });

export type Personal = z.infer<typeof personalSchema>;

/** Default empty value matching the JSONB column default in 0006_clients.sql. */
export const personalDefault: Personal = personalSchema.parse({ dependants: [] });
