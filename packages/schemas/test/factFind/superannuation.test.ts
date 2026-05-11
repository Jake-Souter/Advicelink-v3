import { describe, expect, it } from 'vitest';

import { superannuationSchema } from '../../src/factFind/superannuation.js';

const uuid = (n: number): string => `${String(n).padStart(8, '0')}-5555-4555-8555-555555555555`;

describe('superannuationSchema', () => {
  it('defaults currentFunds to []', () => {
    expect(superannuationSchema.parse({}).currentFunds).toEqual([]);
  });

  it('accepts up to 10 funds', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: uuid(i + 1),
      fundName: `Fund ${i}`,
      currentBalance: 1000,
    }));
    expect(superannuationSchema.safeParse({ currentFunds: items }).success).toBe(true);
  });

  it('rejects 11 funds', () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      id: uuid(i + 1),
      fundName: `Fund ${i}`,
      currentBalance: 1000,
    }));
    const r = superannuationSchema.safeParse({ currentFunds: items });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.message).toMatch(/Maximum 10/);
    }
  });

  it('accepts only the 5 documented per-fund fields (rejects USI etc.)', () => {
    const r = superannuationSchema.safeParse({
      currentFunds: [{ id: uuid(1), fundName: 'X', currentBalance: 1, usi: 'XYZ123' }],
    });
    expect(r.success).toBe(false);
  });
});
