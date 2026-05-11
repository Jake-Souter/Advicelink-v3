import { describe, expect, it } from 'vitest';

import { contributionItemSchema, contributionsSchema } from '../../src/factFind/contributions.js';

const uuid = (n: number): string => `${String(n).padStart(8, '0')}-6666-4666-8666-666666666666`;

describe('contributionItemSchema', () => {
  it('accepts a Salary Sacrifice item', () => {
    const r = contributionItemSchema.safeParse({
      id: uuid(1),
      type: 'Salary Sacrifice',
      amount: 500,
      frequency: 'Monthly',
    });
    expect(r.success).toBe(true);
  });

  it('rejects noiSubmitted on a non-Personal-Concessional row', () => {
    const r = contributionItemSchema.safeParse({
      id: uuid(2),
      type: 'Spouse',
      amount: 100,
      frequency: 'Annual',
      noiSubmitted: true,
    });
    expect(r.success).toBe(false);
  });

  it('accepts noiSubmitted on Personal Concessional', () => {
    const r = contributionItemSchema.safeParse({
      id: uuid(3),
      type: 'Personal Concessional',
      amount: 5000,
      frequency: 'Annual',
      noiSubmitted: true,
    });
    expect(r.success).toBe(true);
  });
});

describe('contributionsSchema', () => {
  it('defaults items to []', () => {
    expect(contributionsSchema.parse({}).items).toEqual([]);
  });
});
