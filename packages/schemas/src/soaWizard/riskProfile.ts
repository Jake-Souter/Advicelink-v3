import { z } from 'zod';

import { longText, riskProfileBandSchema } from './primitives.js';

/**
 * §19.1.5 `riskProfile` — the SOA's risk-profile recommendation.
 *
 * `recommendedProfile` typically equals the client's measured profile
 * (Fact Find risk_profile.riskProfile) but may be overridden by the
 * adviser; `rationaleIfOverridden` is required when the two differ
 * — the gate is enforced server-side at finalise time, not in the
 * schema, because mid-edit drafts must persist before the adviser
 * supplies a rationale.
 */
export const riskProfileSchema = z
  .object({
    recommendedProfile: riskProfileBandSchema.optional(),
    rationaleIfOverridden: longText.optional(),
    /** Default 3 years (REBUILD_PLAN §19.1.5). */
    reviewWindowYears: z.number().int().min(1).max(10).optional(),
    notes: longText.optional(),
  })
  .strict();

export type RiskProfile = z.infer<typeof riskProfileSchema>;
export const riskProfileDefault: RiskProfile = riskProfileSchema.parse({});
