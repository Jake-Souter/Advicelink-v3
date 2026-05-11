import { describe, expect, it } from 'vitest';

import { isPartneredStatus, personalSchema } from '../../src/factFind/personal.js';

describe('personalSchema', () => {
  it('accepts a fully empty object (autosave on a brand-new client)', () => {
    const result = personalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('parses a complete personal payload with dependants and addresses', () => {
    const result = personalSchema.safeParse({
      firstName: 'Alice',
      surname: 'Smith',
      title: 'Ms',
      gender: 'Female',
      dateOfBirth: '1985-04-12',
      mobile: '0412 345 678',
      email: 'alice@example.com',
      homeAddress: { street: '1 Main St', suburb: 'Surry Hills', state: 'NSW', postcode: '2010' },
      hasDifferentPostalAddress: true,
      postalAddress: { street: 'PO Box 1', suburb: 'Sydney', state: 'NSW', postcode: '2000' },
      height: 168,
      weight: 65,
      smokerStatus: 'NO',
      maritalStatus: 'Married',
      partnerName: 'Bob Smith',
      hasDependants: true,
      dependants: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          firstName: 'Charlie',
          surname: 'Smith',
          dateOfBirth: '2018-01-01',
        },
      ],
      hasWill: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a postcode that is not 4 digits', () => {
    const result = personalSchema.safeParse({
      homeAddress: { state: 'NSW', postcode: '21' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an Australian mobile in the wrong format', () => {
    const result = personalSchema.safeParse({ mobile: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects postalAddress when hasDifferentPostalAddress is false', () => {
    const result = personalSchema.safeParse({
      hasDifferentPostalAddress: false,
      postalAddress: { state: 'NSW', postcode: '2000' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects insuranceClaim when hasClaimedOnInsurance is false', () => {
    const result = personalSchema.safeParse({
      hasClaimedOnInsurance: false,
      insuranceClaim: { dateOfClaim: '2020-01-01' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects bankruptcy when hasBeenBankrupt is false', () => {
    const result = personalSchema.safeParse({
      hasBeenBankrupt: false,
      bankruptcy: { dateOfBankruptcy: '2010-06-01' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects dependants when hasDependants is false', () => {
    const result = personalSchema.safeParse({
      hasDependants: false,
      dependants: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          firstName: 'X',
          surname: 'Y',
          dateOfBirth: '2020-01-01',
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = personalSchema.safeParse({ randomField: 'no' });
    expect(result.success).toBe(false);
  });
});

describe('isPartneredStatus', () => {
  it.each([
    ['Married', true],
    ['De facto', true],
    ['Single', false],
    ['Divorced', false],
    ['Separated', false],
    ['Widowed', false],
  ] as const)('%s -> %s', (status, expected) => {
    expect(isPartneredStatus(status)).toBe(expected);
  });

  it('returns false for null/undefined', () => {
    expect(isPartneredStatus(null)).toBe(false);
    expect(isPartneredStatus(undefined)).toBe(false);
  });
});
