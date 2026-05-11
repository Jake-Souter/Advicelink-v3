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

  it('isFromMatch respects wildcard semantics (terminal states excluded)', () => {
    const markLost = getTransition('markLost');
    expect(markLost.from).toBe('*');
    expect(isFromMatch(markLost, 'newLead')).toBe(true);
    expect(isFromMatch(markLost, 'draftingSOA')).toBe(true);
    expect(isFromMatch(markLost, 'lost')).toBe(false);
    expect(isFromMatch(markLost, 'offboarded')).toBe(false);
  });

  it('explicit-from transitions reject unrelated source states', () => {
    const startFactFind = getTransition('startFactFind');
    expect(isFromMatch(startFactFind, 'newLead')).toBe(true);
    expect(isFromMatch(startFactFind, 'factFinding')).toBe(false);
  });
});

describe('canTransition — happy path for every transition', () => {
  for (const t of TRANSITIONS) {
    const fromState = t.from === '*' ? 'newLead' : t.from[0]!;
    const role: Role = t.allowedRoles[0] ?? 'adviser';
    const isSystem = t.allowedRoles.length === 0;

    it(`${t.name}: ${fromState} → ${t.to} as ${isSystem ? 'system' : role}`, () => {
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
      { workflowState: 'newLead' },
      { role: 'adviser' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'unknown_transition' });
  });

  it('returns invalid_from_state when the source does not match', () => {
    const decision = canTransition(
      'lockFactFind',
      { workflowState: 'newLead' },
      { role: 'adviser' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'invalid_from_state' });
  });

  it('returns invalid_from_state when the subject has no workflowState', () => {
    const decision = canTransition('startFactFind', {}, { role: 'lead_gen' });
    expect(decision).toMatchObject({ ok: false, reason: 'invalid_from_state' });
  });

  it('returns role_not_allowed when the actor role is outside the allow-list', () => {
    const decision = canTransition(
      'lockFactFind',
      { workflowState: 'handedOffToAdvice' },
      { role: 'paraplanner' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'role_not_allowed' });
  });

  it('returns reason_required for markLost without a reason', () => {
    const decision = canTransition('markLost', { workflowState: 'newLead' }, { role: 'lead_gen' });
    expect(decision).toMatchObject({ ok: false, reason: 'reason_required' });
  });

  it('returns reason_required for whitespace-only reason', () => {
    const decision = canTransition(
      'markLost',
      { workflowState: 'newLead' },
      { role: 'lead_gen' },
      { reason: '   \t  ' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'reason_required' });
  });

  it('accepts markLost with a real reason', () => {
    const decision = canTransition(
      'markLost',
      { workflowState: 'newLead' },
      { role: 'lead_gen' },
      { reason: 'client unresponsive after 30 days' },
    );
    expect(decision).toEqual({ ok: true });
  });

  it('returns system_only for firstSectionSaved triggered by a user', () => {
    const decision = canTransition(
      'firstSectionSaved',
      { workflowState: 'paraplannerClaimed' },
      { role: 'paraplanner' },
    );
    expect(decision).toMatchObject({ ok: false, reason: 'system_only' });
  });

  it('accepts firstSectionSaved when isSystem: true', () => {
    const decision = canTransition(
      'firstSectionSaved',
      { workflowState: 'paraplannerClaimed' },
      { role: 'paraplanner' },
      { isSystem: true },
    );
    expect(decision).toEqual({ ok: true });
  });

  it('accepts auto cron transitions when isSystem: true', () => {
    const decision = canTransition(
      'autoFlagARDue',
      { workflowState: 'servicing' },
      { role: 'paraplanner' }, // role irrelevant
      { isSystem: true },
    );
    expect(decision).toEqual({ ok: true });
  });
});

describe('canTransition — super-admin escape hatch', () => {
  for (const role of ['tenant_super_admin', 'platform_super_admin'] as const) {
    it(`${role} can fire any user transition`, () => {
      for (const t of TRANSITIONS) {
        if (t.allowedRoles.length === 0) continue; // system/cron
        const fromState = t.from === '*' ? 'newLead' : t.from[0]!;
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
      const fromState = t.from === '*' ? 'newLead' : t.from[0]!;
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
  it('hides system-only transitions by default', () => {
    const list = transitionsAvailable(
      { workflowState: 'paraplannerClaimed' },
      { role: 'paraplanner' },
    );
    expect(list).not.toContain('firstSectionSaved');
    expect(list).toContain('releaseClaim');
  });

  it('includes system transitions when includeSystem: true', () => {
    const list = transitionsAvailable(
      { workflowState: 'paraplannerClaimed' },
      { role: 'paraplanner' },
      { includeSystem: true },
    );
    expect(list).toContain('firstSectionSaved');
  });

  it('offers markLost / offboard from non-terminal states for the right roles', () => {
    expect(transitionsAvailable({ workflowState: 'draftingSOA' }, { role: 'adviser' })).toContain(
      'offboard',
    );
    expect(transitionsAvailable({ workflowState: 'newLead' }, { role: 'lead_gen' })).toContain(
      'markLost',
    );
  });

  it('does not offer markLost / offboard from terminal states', () => {
    expect(transitionsAvailable({ workflowState: 'lost' }, { role: 'adviser' })).toEqual([]);
    expect(transitionsAvailable({ workflowState: 'offboarded' }, { role: 'adviser' })).toEqual([]);
  });

  it('returns an empty list for a role with no permitted transitions on the current state', () => {
    expect(transitionsAvailable({ workflowState: 'newLead' }, { role: 'paraplanner' })).toEqual([]);
  });
});
