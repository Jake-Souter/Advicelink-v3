import { z } from 'zod';

import { isoDateSchema, shortText } from './primitives.js';

/**
 * §19.1.1 `cover` — the SOA's title page.
 *
 * Most fields auto-populate on first wizard open from the client + tenant
 * row (preparedFor from `personal.firstName + surname`, preparedBy from
 * the assigned adviser, ARN from the team's licensee config). The
 * adviser can override every field before lock; nothing in `cover` is
 * derived server-side.
 */
export const coverSchema = z
  .object({
    documentTitle: shortText.optional(),
    /** Lookup: personal.firstName + ' ' + personal.surname (and partner). */
    preparedFor: shortText.optional(),
    preparedForPartner: z.boolean().optional(),
    /** adviser display name. */
    preparedBy: shortText.optional(),
    /** From `team.config.authorisedRepresentativeNumber`. */
    authorisedRepresentativeNumber: shortText.optional(),
    preparationDate: isoDateSchema.optional(),
    /** Default = preparationDate + 30 days. */
    validUntilDate: isoDateSchema.optional(),
    /** Optional storage key overriding the tenant default cover image. */
    coverImageOverride: z.string().min(1).optional().nullable(),
  })
  .strict();

export type Cover = z.infer<typeof coverSchema>;
export const coverDefault: Cover = coverSchema.parse({});
