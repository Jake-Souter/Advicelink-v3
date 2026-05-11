import { describe, expect, it } from 'vitest';

import type { Role } from '@advicelink/rbac';

import {
  TRANSITIONS,
  getTransition,
  isFromMatch,
  type WorkflowTransitionName,
} from '../src/transitions.js';
import { canTransition, transitionsAvailable } from '../src/canTransition.js';

const ALL_ROLES: readonly Role[] = [
  'platform_super_admin',
  'tenant_super_admin',
  'lead_gen',
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management',
  'legacy_import',
];

describe('TRANSITIONS table', () => {
  it('has unique transition names', () => {
    const names = TRANSITIONS.map((t) => t.name);
    const set = new Set(names);
    expect(set.size).toBe(names.length);
  });

  it('every transition is round-trippable through getTransition', () => {
    for (const t of TRANSITIONS) {
      expect(getTransition(t.name).name).toBe(t.name);
    }
  });

  it('getTransition throws on unknown name', () => {
    expect(() => getTransition('nope' as WorkflowTransitionName)).toThrow(/unknown transition/);
  });

  it('isFromMatch — explicit-from transitions reject unrelated source states', () => {
    const lockFactFind = getTransition('lockFactFind');
    expect(isFromMatch(lockFactFind, 'factFinding')).toBe(true);
    expect(isFromMatch(lockFactFind, 'draftingSOA')).toBe(false);
  });

  it('isFromMatch — markLost matches every lead-gen-owned state and nothing else', () => {
    const markLost = getTransition('markLost');
    for (const state of [
      'factFinding',
      'draftingSOA',
      'reviewingSOA',
      'amendingSOA',
      'presentingSOA',
    ] as const) {
      expect(isFromMatch(markLost, state), `expected match on ${state}`).toBe(true);
    }
    for (const state of [
      'welcomeCallScheduled',
      'implementingAdvice',
      'arBooked',
      'lost',
    ] as const) {
      expect(isFromMatch(markLost, state), `expected no match on ${state}`).toBe(false);
    }
  });

  it('autoFlagARDue fires from both implementingAdvice and waitingForAR', () => {
    const t = getTransition('autoFlagARDue');
    expect(t.from).toEqual(['implementingAdvice', 'waitingForAR']);
    expect(t.to).toBe('dueForAR');
    expect(t.trigger).toBe('cron');
  });

  it('DocuSign-driven transitions use the webhook trigger', () => {
    expect(getTransition('recordClientSigned').trigger).toBe('webhook');
    expect(getTransition('recordARPackSigned').trigger).toBe('webhook');
  });

  it('all closed transitions require a reason', () => {
    expect(getTransition('markLost').requiresReason).toBe(true);
  });
});

describe('canTransition — happy path for every transition', () => {
  for (const t of TRANSITIONS) {
    const fromState = t.from === '*' ? 'factFinding' : t.from[0]!;
    const role: Role = t.allowedRoles[0] ?? 'adviser';
    const isSystem = t.allowedRoles.length === 0;

    it(`${t.name}: ${fromState} → ${t.to} as ${isSystem ? 'system/cron/webhook' : role}`, () => {
      const decision = canTransition(
        t.name,
        { workflowState: fromState },
        { role },
        {
          isSystem,
          reason: t.requiresReason ? 'compliance reason' : undefined,
        },
      );
      expect(decision).toEqual({ ok: true });
    });
  }
});

describe('canTransition — rejection cases', () => {
  it('returns unknown_transition for a missing name', () => {
    const decision = canTransition(
      'nope' as WorkflowTransitionName,
      { workflowState: 'factFinding' },
      { role: 'adviser' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'unknown_transition' });
  });

  it('returns invalid_from_state when the source does not match', () => {
    const decision = canTransition(
      'approveSOA',
      { workflowState: 'factFinding' },
      { role: 'adviser' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'invalid_from_state' });
  });

  it('returns invalid_from_state when the subject has no workflowState', () => {
    const decision = canTransition('lockFactFind', {}, { role: 'paraplanner' });
    expect(decision).toMatchObject({ ok: false, reason: 'invalid_from_state' });
  });

  it('returns role_not_allowed when the actor role is outside the allow-list', () => {
    const decision = canTransition(
      'approveSOA',
      { workflowState: 'reviewingSOA' },
      { role: 'paraplanner' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'role_not_allowed' });
  });

  it('returns reason_required for markLost without a reason', () => {
    const decision = canTransition(
      'markLost',
      { workflowState: 'factFinding' },
      { role: 'lead_gen' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'reason_required' });
  });

  it('returns reason_required for whitespace-only reason', () => {
    const decision = canTransition(
      'markLost',
      { workflowState: 'factFinding' },
      { role: 'lead_gen' },
      { reason: '   \t  ' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'reason_required' });
  });

  it('accepts markLost with a real reason', () => {
    const decision = canTransition(
      'markLost',
      { workflowState: 'presentingSOA' },
      { role: 'lead_gen' },
      { reason: 'client refused to sign onboarding pack' },
    );
    expect(decision).toEqual({ ok: true });
  });

  it('refuses markLost from advice-tenant-owned states (post-handoff)', () => {
    const decision = canTransition(
      'markLost',
      { workflowState: 'welcomeCallScheduled' },
      { role: 'lead_gen' },
      { reason: 'why are you trying this' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'invalid_from_state' });
  });

  it('returns system_only for webhook transitions triggered by a user', () => {
    const decision = canTransition(
      'recordClientSigned',
      { workflowState: 'presentingSOA' },
      { role: 'adviser' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'system_only' });
  });

  it('accepts recordClientSigned when isSystem: true (DocuSign webhook)', () => {
    const decision = canTransition(
      'recordClientSigned',
      { workflowState: 'presentingSOA' },
      { role: 'lead_gen' }, // role irrelevant
      { isSystem: true },
    );
    expect(decision).toEqual({ ok: true });
  });

  it('accepts autoFlagARDue when isSystem: true (cron)', () => {
    expect(
      canTransition(
        'autoFlagARDue',
        { workflowState: 'implementingAdvice' },
        { role: 'paraplanner' },
        { isSystem: true },
      ),
    ).toEqual({ ok: true });
    expect(
      canTransition(
        'autoFlagARDue',
        { workflowState: 'waitingForAR' },
        { role: 'paraplanner' },
        { isSystem: true },
      ),
    ).toEqual({ ok: true });
  });

  it('accepts recordARPackSigned only as a webhook from arComplete', () => {
    expect(
      canTransition('recordARPackSigned', { workflowState: 'arComplete' }, { role: 'adviser' }),
    ).toMatchObject({ ok: false, reason: 'system_only' });
    expect(
      canTransition(
        'recordARPackSigned',
        { workflowState: 'arComplete' },
        { role: 'adviser' },
        { isSystem: true },
      ),
    ).toEqual({ ok: true });
  });
});

describe('canTransition — super-admin escape hatch', () => {
  for (const role of ['tenant_super_admin', 'platform_super_admin'] as const) {
    it(`${role} can fire any user transition`, () => {
      for (const t of TRANSITIONS) {
        if (t.allowedRoles.length === 0) continue; // system/cron/webhook
        const fromState = t.from === '*' ? 'factFinding' : t.from[0]!;
        const decision = canTransition(
          t.name,
          { workflowState: fromState },
          { role },
          { reason: t.requiresReason ? 'admin override' : undefined },
        );
        expect(decision, `super-admin '${role}' rejected on '${t.name}'`).toEqual({ ok: true });
      }
    });
  }
});

describe('canTransition — exhaustive role rejection coverage', () => {
  // For every transition with a non-empty allow-list, every role
  // *outside* that list (and not a super-admin) must be rejected.
  for (const t of TRANSITIONS) {
    if (t.allowedRoles.length === 0) continue;
    const allow = new Set<Role>([...t.allowedRoles, 'tenant_super_admin', 'platform_super_admin']);
    const denied = ALL_ROLES.filter((r) => !allow.has(r));
    if (denied.length === 0) continue;

    it(`${t.name} rejects ${denied.join(', ')}`, () => {
      const fromState = t.from === '*' ? 'factFinding' : t.from[0]!;
      for (const role of denied) {
        const decision = canTransition(
          t.name,
          { workflowState: fromState },
          { role },
          { reason: t.requiresReason ? 'r' : undefined },
        );
        expect(decision, `expected '${role}' rejected on '${t.name}'`).toMatchObject({
          ok: false,
          reason: 'role_not_allowed',
        });
      }
    });
  }
});

describe('transitionsAvailable', () => {
  it('hides system / webhook / cron transitions by default', () => {
    const list = transitionsAvailable({ workflowState: 'presentingSOA' }, { role: 'lead_gen' });
    expect(list).not.toContain('recordClientSigned');
    // markLost is reason-required and surfaces (UI collects the reason on click)
    expect(list).toContain('markLost');
  });

  it('includes system / webhook / cron transitions when includeSystem: true', () => {
    const list = transitionsAvailable(
      { workflowState: 'presentingSOA' },
      { role: 'lead_gen' },
      { includeSystem: true },
    );
    expect(list).toContain('recordClientSigned');
  });

  it('offers AR cadence transitions to ar_support / ar_adviser only', () => {
    expect(transitionsAvailable({ workflowState: 'dueForAR' }, { role: 'ar_support' })).toContain(
      'bookAR',
    );
    expect(
      transitionsAvailable({ workflowState: 'dueForAR' }, { role: 'paraplanner' }),
    ).not.toContain('bookAR');
    expect(transitionsAvailable({ workflowState: 'arBooked' }, { role: 'ar_adviser' })).toEqual(
      expect.arrayContaining(['requestARDocument', 'selfServeARComplete']),
    );
  });

  it('does not offer markLost from terminal states', () => {
    expect(transitionsAvailable({ workflowState: 'lost' }, { role: 'lead_gen' })).toEqual([]);
  });

  it('returns an empty list for a role with no permitted transitions on the current state', () => {
    // Lead-gen has lost access post-flip; welcomeCallScheduled is
    // adviser-owned. Lead-gen cannot even markLost from here (the
    // markLost from-list ends at presentingSOA).
    expect(
      transitionsAvailable({ workflowState: 'welcomeCallScheduled' }, { role: 'lead_gen' }),
    ).toEqual([]);
  });

  it('does not surface markLost to non-lead-gen roles even pre-handoff', () => {
    expect(
      transitionsAvailable({ workflowState: 'draftingSOA' }, { role: 'paraplanner' }),
    ).not.toContain('markLost');
  });
});
