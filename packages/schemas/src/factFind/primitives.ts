import { z } from 'zod';

/**
 * Fact Find primitives — shared building blocks used across the 12
 * section schemas. Kept tiny on purpose; per-section files extend
 * these with section-specific narrowing.
 *
 * Conventions
 * -----------
 *  * Fact Find sections must accept partial saves (the wizard
 *    autosaves piecewise) so most fields are optional. The "is this
 *    section ready to lock?" check lives in the service layer
 *    (`assertReadyToLock`, WP-6.3) and is intentionally separate from
 *    these "is this shape valid for storage?" schemas.
 *  * IDs are uuids generated client-side so optimistic UI works
 *    without a server round-trip.
 *  * Money is a `number` rather than a `bigint` because every dollar
 *    figure in this domain fits comfortably in a JS double — wealth
 *    figures top out at ~10^9. We round to 2 dp at write time in the
 *    derivations layer.
 *  * Dates are ISO 8601 strings; `IsoDate` is `YYYY-MM-DD` (no time),
 *    `IsoDateTime` is the full RFC3339 form.
 */

export const uuidSchema = z.string().uuid();

export const isoDateSchema = z.string().date();
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** A money amount in the client's tenant currency (always AUD at v1). */
export const moneySchema = z.number().finite().nonnegative();

/** Allow signed money (e.g. negative cashflows). */
export const signedMoneySchema = z.number().finite();

/** A percentage stored as a number 0-100 (NOT 0-1). */
export const percentageSchema = z.number().finite().min(0).max(100);

/**
 * The five frequency tokens are reused by financial.incomes,
 * contributions, asset repayments, and insurance premiums. The set is
 * intentionally small and shared so the derivations layer can lift
 * any frequency-bearing record to an annual figure with a single
 * lookup.
 */
export const frequencySchema = z.enum(['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Annual']);
export type Frequency = z.infer<typeof frequencySchema>;

/**
 * Multipliers used by the derivations layer (and shared with the
 * projection engine in WP-9). Keep co-located with the enum so the
 * two cannot drift.
 */
export const FREQUENCY_PER_YEAR: Record<Frequency, number> = {
  Weekly: 52,
  Fortnightly: 26,
  Monthly: 12,
  Quarterly: 4,
  Annual: 1,
};

/**
 * Australian addresses. State is a discriminated union so the UI can
 * render a `<Select>` without typoing 'NWS'. Postcode is `string`
 * because Australian postcodes are 4-digit but leading-zero
 * safety is best preserved as text.
 */
export const auStateSchema = z.enum(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
export type AuState = z.infer<typeof auStateSchema>;

export const addressSchema = z
  .object({
    street: z.string().trim().min(1).optional(),
    suburb: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    state: auStateSchema.optional(),
    postcode: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'Postcode must be 4 digits')
      .optional(),
    country: z.string().trim().min(1).default('Australia'),
  })
  .strict();
export type Address = z.infer<typeof addressSchema>;

/**
 * Australian Tax File Number — 8 or 9 digits, no spaces. The
 * application stores TFNs encrypted via `app_encrypt_tfn` (see
 * `migrations/0006_clients.sql`); the schema validates the **plaintext**
 * before it ever reaches the encryption helper. Real TFNs in this
 * codebase only ever live on the wire and inside a single
 * `withTenantContext` transaction; anything that hits disk is the
 * armored ciphertext.
 *
 * The official 11-digit TFN check digit is intentionally NOT enforced
 * here because the legacy data set contains valid pre-1988 TFNs that
 * predate the algorithm; tightening this would block re-importing
 * historical clients.
 */
export const tfnPlaintextSchema = z
  .string()
  .trim()
  .regex(/^\d{8,9}$/, 'TFN must be 8 or 9 digits with no spaces');

/**
 * E.164-ish — accept Australian mobiles in either `04xx xxx xxx` form
 * or `+614xx xxx xxx`. Stored normalised to `+614xxxxxxxx` by the
 * service layer.
 */
export const auMobileSchema = z
  .string()
  .trim()
  .regex(/^(\+?61\s?4|04)\d{2}\s?\d{3}\s?\d{3}$/, 'Enter an Australian mobile number');

export const emailSchema = z.string().trim().toLowerCase().email();

/**
 * The set of yes/no/former values used for smoker status, dependants
 * presence, etc. Kept upper-case to match the legacy DB rows so a
 * data import in WP-12 doesn't have to case-fold.
 */
export const yesNoFormerSchema = z.enum(['YES', 'NO', 'FORMER']);
export const yesNoSchema = z.enum(['YES', 'NO']);
