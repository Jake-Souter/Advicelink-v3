import { describe, expect, it } from 'vitest';

import { insuranceCoverSchema, isIpCover } from '../../src/factFind/insurance.js';

const uuid = (n: number): string => `${String(n).padStart(8, '0')}-3333-4333-8333-333333333333`;

describe('insuranceCoverSchema', () => {
  it('accepts a Life cover with coverAmount', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(1),
      coverType: 'Life',
      coverAmount: 500000,
      premium: 1200,
      premiumFrequency: 'Annual',
      payee: 'Self',
      insurer: 'AIA',
      premiumType: 'Stepped',
    });
    expect(r.success).toBe(true);
  });

  it('rejects a Life cover that carries monthlyBenefit', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(1),
      coverType: 'Life',
      coverAmount: 500000,
      monthlyBenefit: 5000,
    });
    expect(r.success).toBe(false);
  });

  it('rejects an IP cover that carries coverAmount', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(1),
      coverType: 'IP',
      coverAmount: 5000,
      monthlyBenefit: 5000,
    });
    expect(r.success).toBe(false);
  });

  it('accepts an IP cover with monthlyBenefit + waiting/benefit periods', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(2),
      coverType: 'IP',
      monthlyBenefit: 5000,
      waitingPeriod: '30 days',
      benefitPeriod: 'to age 65',
    });
    expect(r.success).toBe(true);
  });

  it('rejects waitingPeriod on a non-IP cover', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(2),
      coverType: 'Life',
      coverAmount: 100,
      waitingPeriod: '30 days',
    });
    expect(r.success).toBe(false);
  });

  it('accepts TPD with definition + structure', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(3),
      coverType: 'TPD',
      coverAmount: 250000,
      definition: 'Own Occ',
      structure: 'Standalone',
    });
    expect(r.success).toBe(true);
  });

  it('rejects definition on a non-TPD cover', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(3),
      coverType: 'Life',
      coverAmount: 100,
      definition: 'Own Occ',
    });
    expect(r.success).toBe(false);
  });

  it('rejects premium without premiumFrequency', () => {
    const r = insuranceCoverSchema.safeParse({
      id: uuid(4),
      coverType: 'Life',
      coverAmount: 100,
      premium: 100,
    });
    expect(r.success).toBe(false);
  });
});

describe('isIpCover', () => {
  it('treats both IP and the legacy "Income Protection" alias as IP', () => {
    expect(isIpCover('IP')).toBe(true);
    expect(isIpCover('Income Protection')).toBe(true);
    expect(isIpCover('Life')).toBe(false);
    expect(isIpCover('TPD')).toBe(false);
    expect(isIpCover('Trauma')).toBe(false);
  });
});
