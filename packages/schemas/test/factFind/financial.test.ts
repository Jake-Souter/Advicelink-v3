import { describe, expect, it } from 'vitest';

import { financialSchema, incomeItemSchema } from '../../src/factFind/financial.js';

const uuid = (n: number): string => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

describe('incomeItemSchema', () => {
  it('accepts a salary income with SG fields', () => {
    const result = incomeItemSchema.safeParse({
      id: uuid(1),
      incomeType: 'Salary',
      grossAnnual: 120000,
      sgEligible: true,
      superGuaranteePercent: 12,
    });
    expect(result.success).toBe(true);
  });

  it('rejects sgEligible=true without superGuaranteePercent', () => {
    const result = incomeItemSchema.safeParse({
      id: uuid(1),
      incomeType: 'Salary',
      grossAnnual: 120000,
      sgEligible: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('superGuaranteePercent'))).toBe(true);
    }
  });

  it('rejects sgEligible=false WITH superGuaranteePercent', () => {
    const result = incomeItemSchema.safeParse({
      id: uuid(1),
      incomeType: 'Self-employed',
      grossAnnual: 50000,
      sgEligible: false,
      superGuaranteePercent: 12,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative grossAnnual', () => {
    const result = incomeItemSchema.safeParse({
      id: uuid(1),
      incomeType: 'Salary',
      grossAnnual: -1,
      sgEligible: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('financialSchema', () => {
  it('defaults incomes to []', () => {
    const result = financialSchema.parse({});
    expect(result.incomes).toEqual([]);
  });

  it('caps incomes at 20', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: uuid(i + 1),
      incomeType: 'Salary' as const,
      grossAnnual: 1000,
      sgEligible: false,
    }));
    const result = financialSchema.safeParse({ incomes: items });
    expect(result.success).toBe(false);
  });
});
