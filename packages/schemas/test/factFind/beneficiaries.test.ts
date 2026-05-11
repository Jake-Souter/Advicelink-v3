import { describe, expect, it } from 'vitest';

import { beneficiariesSchema } from '../../src/factFind/beneficiaries.js';

const uuid = (n: number): string => `${String(n).padStart(8, '0')}-4444-4444-8444-444444444444`;

describe('beneficiariesSchema', () => {
  it('accepts an empty list', () => {
    const r = beneficiariesSchema.safeParse({ items: [] });
    expect(r.success).toBe(true);
  });

  it('accepts allocations summing under 100% per fund (mid-edit)', () => {
    const r = beneficiariesSchema.safeParse({
      items: [
        {
          id: uuid(1),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'A',
          surname: 'A',
          percentage: 60,
        },
        {
          id: uuid(2),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'B',
          surname: 'B',
          percentage: 30,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts allocations summing to exactly 100% per fund', () => {
    const r = beneficiariesSchema.safeParse({
      items: [
        {
          id: uuid(1),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'A',
          surname: 'A',
          percentage: 50,
        },
        {
          id: uuid(2),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'B',
          surname: 'B',
          percentage: 50,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects allocations summing OVER 100% per fund', () => {
    const r = beneficiariesSchema.safeParse({
      items: [
        {
          id: uuid(1),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'A',
          surname: 'A',
          percentage: 80,
        },
        {
          id: uuid(2),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'B',
          surname: 'B',
          percentage: 30,
        },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.message).toMatch(/exceed 100%/);
    }
  });

  it('treats different funds independently', () => {
    const r = beneficiariesSchema.safeParse({
      items: [
        {
          id: uuid(1),
          fundOrPolicy: 'AustralianSuper',
          firstName: 'A',
          surname: 'A',
          percentage: 100,
        },
        { id: uuid(2), fundOrPolicy: 'Hostplus', firstName: 'B', surname: 'B', percentage: 100 },
      ],
    });
    expect(r.success).toBe(true);
  });
});
