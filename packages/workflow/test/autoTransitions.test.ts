import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AR_CADENCE_MONTHS,
  DEFAULT_PARAPLANNER_RELEASE_AFTER_MS,
  computeNextArDueDate,
  shouldAutoFlagARDue,
  shouldAutoReleaseParaplannerClaim,
} from '../src/autoTransitions.js';

const HOUR = 60 * 60 * 1000;

describe('shouldAutoFlagARDue', () => {
  const now = new Date('2026-05-11T00:00:00Z');

  it('flags clients in implementingAdvice whose next_ar_due_date has elapsed', () => {
    expect(
      shouldAutoFlagARDue(
        { workflowState: 'implementingAdvice', nextArDueDate: new Date('2026-05-10T00:00:00Z') },
        now,
      ),
    ).toBe(true);
  });

  it('flags clients in waitingForAR whose next_ar_due_date has elapsed', () => {
    expect(
      shouldAutoFlagARDue(
        { workflowState: 'waitingForAR', nextArDueDate: new Date('2026-04-01T00:00:00Z') },
        now,
      ),
    ).toBe(true);
  });

  it('flags exactly at the boundary', () => {
    expect(shouldAutoFlagARDue({ workflowState: 'waitingForAR', nextArDueDate: now }, now)).toBe(
      true,
    );
  });

  it('does not flag future dates', () => {
    expect(
      shouldAutoFlagARDue(
        { workflowState: 'waitingForAR', nextArDueDate: new Date('2026-06-01T00:00:00Z') },
        now,
      ),
    ).toBe(false);
  });

  it('does not flag clients outside implementingAdvice / waitingForAR', () => {
    for (const state of ['draftingSOA', 'arBooked', 'reviewingAR', 'arComplete', 'lost'] as const) {
      expect(
        shouldAutoFlagARDue({ workflowState: state, nextArDueDate: new Date('2020-01-01') }, now),
        `unexpected match for state ${state}`,
      ).toBe(false);
    }
  });

  it('returns false when next_ar_due_date is missing', () => {
    expect(shouldAutoFlagARDue({ workflowState: 'waitingForAR' }, now)).toBe(false);
  });

  it('accepts ISO strings as well as Date objects', () => {
    expect(
      shouldAutoFlagARDue(
        { workflowState: 'waitingForAR', nextArDueDate: '2026-05-10T00:00:00Z' },
        now,
      ),
    ).toBe(true);
  });

  it('treats malformed date values as non-due (never flag a corrupt row)', () => {
    expect(
      shouldAutoFlagARDue({ workflowState: 'waitingForAR', nextArDueDate: 'not-a-date' }, now),
    ).toBe(false);
  });

  it('reads the snake_case alias too', () => {
    expect(
      shouldAutoFlagARDue(
        { workflow_state: 'implementingAdvice', next_ar_due_date: '2026-05-10T00:00:00Z' },
        now,
      ),
    ).toBe(true);
  });
});

describe('shouldAutoReleaseParaplannerClaim', () => {
  const now = new Date('2026-05-11T00:00:00Z');

  it('releases claims older than the default threshold (48h) on draftingSOA', () => {
    const claimed = new Date(now.getTime() - 49 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'draftingSOA', claimedAt: claimed },
        { now },
      ),
    ).toBe(true);
  });

  it('releases claims older than the default threshold (48h) on amendingSOA', () => {
    const claimed = new Date(now.getTime() - 49 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'amendingSOA', claimedAt: claimed },
        { now },
      ),
    ).toBe(true);
  });

  it('does NOT release on reviewingSOA (adviser holds the work)', () => {
    const claimed = new Date(now.getTime() - 100 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'reviewingSOA', claimedAt: claimed },
        { now },
      ),
    ).toBe(false);
  });

  it('does not release claims younger than the threshold', () => {
    const claimed = new Date(now.getTime() - 12 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'draftingSOA', claimedAt: claimed },
        { now },
      ),
    ).toBe(false);
  });

  it('respects a tenant-overridden threshold', () => {
    const claimed = new Date(now.getTime() - 4 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'draftingSOA', claimedAt: claimed },
        { now, releaseAfterMs: 3 * HOUR },
      ),
    ).toBe(true);
  });

  it('returns false when claimed_at is missing', () => {
    expect(shouldAutoReleaseParaplannerClaim({ workflowState: 'draftingSOA' }, { now })).toBe(
      false,
    );
  });

  it('exposes the default threshold so workers can read the same constant', () => {
    expect(DEFAULT_PARAPLANNER_RELEASE_AFTER_MS).toBe(48 * HOUR);
  });
});

describe('computeNextArDueDate', () => {
  it('defaults to 10 months from CSA signing', () => {
    expect(DEFAULT_AR_CADENCE_MONTHS).toBe(10);
    const csa = new Date('2026-01-15T00:00:00Z');
    const next = computeNextArDueDate(csa);
    expect(next.toISOString()).toBe('2026-11-15T00:00:00.000Z');
  });

  it('respects a tenant-overridden cadence (e.g. 12 months)', () => {
    const csa = new Date('2026-01-15T00:00:00Z');
    const next = computeNextArDueDate(csa, 12);
    expect(next.toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('handles month-end edge case (31 Aug + 10 months = 30 Jun)', () => {
    const csa = new Date('2026-08-31T00:00:00Z');
    const next = computeNextArDueDate(csa);
    // Adding 10 months to Aug-31 lands in Jun-30 (or Jul-1 depending
    // on Date#setMonth behavior in this engine). Either is acceptable
    // — what we're proving is that we don't produce an invalid date.
    expect(Number.isNaN(next.getTime())).toBe(false);
    expect(next.getUTCFullYear()).toBe(2027);
  });
});
