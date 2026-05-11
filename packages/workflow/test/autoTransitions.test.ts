import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PARAPLANNER_RELEASE_AFTER_MS,
  shouldAutoFlagARDue,
  shouldAutoReleaseParaplannerClaim,
} from '../src/autoTransitions.js';

const HOUR = 60 * 60 * 1000;

describe('shouldAutoFlagARDue', () => {
  const now = new Date('2026-05-11T00:00:00Z');

  it('flags clients in servicing whose next_ar_date has elapsed', () => {
    expect(
      shouldAutoFlagARDue(
        { workflowState: 'servicing', nextArDate: new Date('2026-05-10T00:00:00Z') },
        now,
      ),
    ).toBe(true);
  });

  it('flags exactly at the boundary', () => {
    expect(shouldAutoFlagARDue({ workflowState: 'servicing', nextArDate: now }, now)).toBe(true);
  });

  it('does not flag future dates', () => {
    expect(
      shouldAutoFlagARDue(
        { workflowState: 'servicing', nextArDate: new Date('2026-06-01T00:00:00Z') },
        now,
      ),
    ).toBe(false);
  });

  it('does not flag clients outside the servicing state', () => {
    expect(
      shouldAutoFlagARDue({ workflowState: 'arDue', nextArDate: new Date('2020-01-01') }, now),
    ).toBe(false);
  });

  it('returns false when next_ar_date is missing', () => {
    expect(shouldAutoFlagARDue({ workflowState: 'servicing' }, now)).toBe(false);
  });

  it('accepts ISO strings as well as Date objects', () => {
    expect(
      shouldAutoFlagARDue({ workflowState: 'servicing', nextArDate: '2026-05-10T00:00:00Z' }, now),
    ).toBe(true);
  });

  it('treats malformed date values as non-due (never flag a corrupt row)', () => {
    expect(shouldAutoFlagARDue({ workflowState: 'servicing', nextArDate: 'not-a-date' }, now)).toBe(
      false,
    );
  });

  it('reads the snake_case alias too', () => {
    expect(
      shouldAutoFlagARDue(
        { workflow_state: 'servicing', next_ar_date: '2026-05-10T00:00:00Z' },
        now,
      ),
    ).toBe(true);
  });
});

describe('shouldAutoReleaseParaplannerClaim', () => {
  const now = new Date('2026-05-11T00:00:00Z');

  it('releases claims older than the default threshold (48h)', () => {
    const claimed = new Date(now.getTime() - 49 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'paraplannerClaimed', claimedAt: claimed },
        { now },
      ),
    ).toBe(true);
  });

  it('does not release claims younger than the threshold', () => {
    const claimed = new Date(now.getTime() - 12 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'paraplannerClaimed', claimedAt: claimed },
        { now },
      ),
    ).toBe(false);
  });

  it('respects a tenant-overridden threshold', () => {
    const claimed = new Date(now.getTime() - 4 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'paraplannerClaimed', claimedAt: claimed },
        { now, releaseAfterMs: 3 * HOUR },
      ),
    ).toBe(true);
  });

  it('only fires on paraplannerClaimed', () => {
    const claimed = new Date(now.getTime() - 100 * HOUR);
    expect(
      shouldAutoReleaseParaplannerClaim(
        { workflowState: 'draftingSOA', claimedAt: claimed },
        { now },
      ),
    ).toBe(false);
  });

  it('returns false when claimed_at is missing', () => {
    expect(
      shouldAutoReleaseParaplannerClaim({ workflowState: 'paraplannerClaimed' }, { now }),
    ).toBe(false);
  });

  it('exposes the default threshold so workers can read the same constant', () => {
    expect(DEFAULT_PARAPLANNER_RELEASE_AFTER_MS).toBe(48 * HOUR);
  });
});
