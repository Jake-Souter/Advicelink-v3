import { describe, expect, it } from 'vitest';

import { redactNamesInString, redactString, redactValue } from '../src/redact.js';

describe('redactString', () => {
  it('redacts a 9-digit TFN', () => {
    expect(redactString('My TFN is 123456789.')).toBe('My TFN is [TFN].');
  });

  it('redacts a spaced TFN', () => {
    expect(redactString('TFN: 123 456 789')).toBe('TFN: [TFN]');
  });

  it('redacts an Australian mobile in 04xx form', () => {
    expect(redactString('Call me on 0412 345 678 today.')).toBe('Call me on [PHONE] today.');
  });

  it('redacts a +614 mobile', () => {
    expect(redactString('+61 412 345 678')).toBe('[PHONE]');
  });

  it('redacts an email address', () => {
    expect(redactString('Email: alice@example.com')).toBe('Email: [EMAIL]');
  });

  it('leaves unrelated text alone', () => {
    expect(redactString('The quick brown fox jumps over the lazy dog.')).toBe(
      'The quick brown fox jumps over the lazy dog.',
    );
  });

  it('redacts multiple PII fragments in a single string', () => {
    expect(redactString('TFN 123456789 phone 0412345678 email a@b.co')).toBe(
      'TFN [TFN] phone [PHONE] email [EMAIL]',
    );
  });
});

describe('redactValue (recursive)', () => {
  it('walks nested objects + arrays', () => {
    const input = {
      personal: { mobile: '0412 345 678', email: 'x@y.z', notes: 'TFN 123456789 noted' },
      dependants: [{ surname: 'Smith', notes: 'DOB on file' }],
    };
    const out = redactValue(input);
    expect(out).toEqual({
      personal: { mobile: '[PHONE]', email: '[EMAIL]', notes: 'TFN [TFN] noted' },
      dependants: [{ surname: 'Smith', notes: 'DOB on file' }],
    });
  });

  it('passes numbers, booleans and null through untouched', () => {
    const input = { age: 42, smoker: false, notes: null, weight: 75.5 };
    const out = redactValue(input);
    expect(out).toEqual(input);
  });
});

describe('redactNamesInString', () => {
  it('redacts a known name (case-insensitive, whole word)', () => {
    expect(redactNamesInString('Alice met alice for coffee.', ['Alice'])).toBe(
      '[NAME] met [NAME] for coffee.',
    );
  });

  it('does not redact a partial match', () => {
    expect(redactNamesInString('Alicia is not Alice', ['Alice'])).toBe('Alicia is not [NAME]');
  });

  it('escapes regex meta-characters in supplied names', () => {
    expect(redactNamesInString('A.B was here', ['A.B'])).toBe('[NAME] was here');
  });

  it('skips empty/short names', () => {
    expect(redactNamesInString('A is here', ['', 'A'])).toBe('A is here');
  });
});
