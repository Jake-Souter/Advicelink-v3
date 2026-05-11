import { z } from 'zod';

import {
  frequencySchema,
  isoDateSchema,
  moneySchema,
  shortText,
  uuidSchema,
} from './primitives.js';

/**
 * §19.1.14 `authorityToProceed` — the SOA's signature page.
 *
 * `consents` is the list of acknowledgement statements the client and
 * adviser tick + sign. `signatureBlocks` mirror the DocuSign signing
 * envelope at finalise time; `signed`/`signedDate` are flipped by the
 * webhook handler in WP-10 (DocuSign), so the editor renders them
 * read-only when populated.
 *
 * `paymentAuthorities` lets the adviser capture standing payment
 * direction (e.g. ongoing-fee deductions from the client's super).
 */
export const consentSchema = z
  .object({
    id: uuidSchema,
    label: shortText,
    defaultChecked: z.boolean().default(false),
    required: z.boolean().default(true),
  })
  .strict();
export type Consent = z.infer<typeof consentSchema>;

export const signatureBlockSchema = z
  .object({
    id: uuidSchema,
    role: z.enum(['client', 'partner', 'adviser']),
    signed: z.boolean().default(false),
    signedDate: isoDateSchema.optional(),
  })
  .strict();
export type SignatureBlock = z.infer<typeof signatureBlockSchema>;

export const paymentAuthoritySchema = z
  .object({
    id: uuidSchema,
    /** 'super-rollover' | 'ongoing-fee' | 'one-off' — kept open as text. */
    type: shortText,
    /** Free-text account ref so we never persist real BSB/Acct numbers
     *  in the wizard JSON; the actual payment instructions live with
     *  the implementation envelope, not here. */
    account: shortText,
    amount: moneySchema.optional(),
    frequency: frequencySchema.optional(),
  })
  .strict();
export type PaymentAuthority = z.infer<typeof paymentAuthoritySchema>;

export const authorityToProceedSchema = z
  .object({
    consents: z.array(consentSchema).max(20).default([]),
    signatureBlocks: z.array(signatureBlockSchema).max(5).default([]),
    paymentAuthorities: z.array(paymentAuthoritySchema).max(20).default([]),
  })
  .strict();

export type AuthorityToProceed = z.infer<typeof authorityToProceedSchema>;
export const authorityToProceedDefault: AuthorityToProceed = authorityToProceedSchema.parse({});
