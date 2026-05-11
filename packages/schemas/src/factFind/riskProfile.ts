import { z } from 'zod';

/**
 * Risk Profile (REBUILD_PLAN §7.5.10 + §19.7).
 *
 * Five questions, each with five answer keys, each key worth 1–5
 * points. Total maps to one of five profile bands. The scoring map
 * is versioned by file name (`scoringMap-2025-08-01`) so a tenant
 * override can pin to a specific version while the default
 * advances.
 *
 * Tenant override of the map will land via the admin module in WP-7
 * — until then, this is the only map. The shape is exported so the
 * future `tenant_settings.risk_profile_scoring_map` jsonb can carry
 * a parseable override.
 */

export const riskProfileBandSchema = z.enum([
  'Defensive',
  'Conservative',
  'Balanced',
  'Growth',
  'Aggressive',
]);
export type RiskProfileBand = z.infer<typeof riskProfileBandSchema>;

/**
 * One canonical map per question. Each value is the points awarded.
 * Order of keys matches the radio order rendered in the UI. We
 * keep them flat (no parent prefixes) because the column on
 * `clients.risk_profile` carries them directly.
 */
export const RISK_PROFILE_SCORING_MAP_VERSION = '2025-08-01';

export const RISK_PROFILE_QUESTION_KEYS = [
  'superannuationCashOut',
  'investmentExperience',
  'superannuationReaction',
  'riskToleranceStyle',
  'experienceLevel',
] as const;
export type RiskProfileQuestionKey = (typeof RISK_PROFILE_QUESTION_KEYS)[number];

export interface RiskProfileScoringMap {
  version: string;
  questions: Record<RiskProfileQuestionKey, Record<string, number>>;
  bands: Array<{ minInclusive: number; maxInclusive: number; band: RiskProfileBand }>;
}

export const DEFAULT_RISK_PROFILE_SCORING_MAP: RiskProfileScoringMap = {
  version: RISK_PROFILE_SCORING_MAP_VERSION,
  questions: {
    superannuationCashOut: {
      wouldNeverCashOut: 5,
      wouldStayCourse: 4,
      wouldReduceRisk: 3,
      wouldCashOutSome: 2,
      wouldCashOutAll: 1,
    },
    investmentExperience: {
      extensiveExperience: 5,
      someExperience: 4,
      limitedExperience: 3,
      littleExperience: 2,
      noExperience: 1,
    },
    superannuationReaction: {
      seeAsOpportunity: 5,
      holdAndWait: 4,
      concernedButHold: 3,
      consultAdviser: 2,
      wouldSell: 1,
    },
    riskToleranceStyle: {
      seekHighestReturns: 5,
      comfortableHigherRisk: 4,
      balancedApproach: 3,
      preferStability: 2,
      avoidRiskEntirely: 1,
    },
    experienceLevel: {
      veryExperienced: 5,
      experienced: 4,
      moderatelyExperienced: 3,
      limitedExperience: 2,
      firstTime: 1,
    },
  },
  bands: [
    { minInclusive: 5, maxInclusive: 8, band: 'Defensive' },
    { minInclusive: 9, maxInclusive: 12, band: 'Conservative' },
    { minInclusive: 13, maxInclusive: 17, band: 'Balanced' },
    { minInclusive: 18, maxInclusive: 21, band: 'Growth' },
    { minInclusive: 22, maxInclusive: 25, band: 'Aggressive' },
  ],
};

/**
 * Per-question answer-key schemas. We allow ANY string at storage
 * time (free-form so a tenant override can introduce new keys
 * without a schema change) and validate against the active scoring
 * map at derivation time. An unknown key produces a `0` for that
 * question and no profile band — i.e. visibly broken UI rather than
 * silent miscalibration.
 */
export const riskProfileSchema = z
  .object({
    superannuationCashOut: z.string().trim().optional(),
    investmentExperience: z.string().trim().optional(),
    superannuationReaction: z.string().trim().optional(),
    riskToleranceStyle: z.string().trim().optional(),
    experienceLevel: z.string().trim().optional(),

    /** Derived. */
    riskScore: z.number().int().min(0).max(25).optional(),
    /** Derived. */
    riskProfile: riskProfileBandSchema.optional(),

    notes: z.string().max(4000).optional(),
  })
  .strict();

export type RiskProfile = z.infer<typeof riskProfileSchema>;
export const riskProfileDefault: RiskProfile = riskProfileSchema.parse({});
