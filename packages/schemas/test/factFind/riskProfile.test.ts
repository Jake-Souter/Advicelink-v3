import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RISK_PROFILE_SCORING_MAP,
  RISK_PROFILE_QUESTION_KEYS,
  RISK_PROFILE_SCORING_MAP_VERSION,
  riskProfileBandSchema,
  riskProfileSchema,
} from '../../src/factFind/riskProfile.js';

describe('riskProfileSchema', () => {
  it('accepts an empty object', () => {
    expect(riskProfileSchema.safeParse({}).success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(riskProfileSchema.safeParse({ unknown: 'x' }).success).toBe(false);
  });

  it('riskScore is bounded 0..25', () => {
    expect(riskProfileSchema.safeParse({ riskScore: 26 }).success).toBe(false);
    expect(riskProfileSchema.safeParse({ riskScore: -1 }).success).toBe(false);
    expect(riskProfileSchema.safeParse({ riskScore: 0 }).success).toBe(true);
    expect(riskProfileSchema.safeParse({ riskScore: 25 }).success).toBe(true);
  });

  it('riskProfile band is one of the 5 known bands', () => {
    expect(riskProfileBandSchema.safeParse('Defensive').success).toBe(true);
    expect(riskProfileBandSchema.safeParse('Wild').success).toBe(false);
  });
});

describe('DEFAULT_RISK_PROFILE_SCORING_MAP', () => {
  it('is versioned', () => {
    expect(DEFAULT_RISK_PROFILE_SCORING_MAP.version).toBe(RISK_PROFILE_SCORING_MAP_VERSION);
  });

  it('has all 5 questions, each with 5 answer keys, each scoring 1..5', () => {
    for (const q of RISK_PROFILE_QUESTION_KEYS) {
      const map = DEFAULT_RISK_PROFILE_SCORING_MAP.questions[q];
      const values = Object.values(map);
      expect(values).toHaveLength(5);
      expect(new Set(values)).toEqual(new Set([1, 2, 3, 4, 5]));
    }
  });

  it('bands cover the full 5..25 range with no overlap', () => {
    const bands = DEFAULT_RISK_PROFILE_SCORING_MAP.bands;
    expect(bands[0]!.minInclusive).toBe(5);
    expect(bands[bands.length - 1]!.maxInclusive).toBe(25);
    for (let i = 0; i < bands.length - 1; i += 1) {
      expect(bands[i + 1]!.minInclusive).toBe(bands[i]!.maxInclusive + 1);
    }
  });
});
