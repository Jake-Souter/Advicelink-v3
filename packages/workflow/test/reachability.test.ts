import { describe, expect, it } from 'vitest';

import { TRANSITIONS, type WorkflowTransition } from '../src/transitions.js';
import { TERMINAL_STATES, WORKFLOW_STATES, type WorkflowState } from '../src/states.js';

/**
 * Builds an adjacency map `from → to[]` from the TRANSITIONS table.
 * Wildcard sources expand to every non-terminal state. The resulting
 * graph is what we BFS for reachability proofs.
 */
function buildAdjacency(): Record<WorkflowState, Set<WorkflowState>> {
  const adj: Record<WorkflowState, Set<WorkflowState>> = {} as Record<
    WorkflowState,
    Set<WorkflowState>
  >;
  for (const s of WORKFLOW_STATES) adj[s] = new Set();

  for (const t of TRANSITIONS) {
    const fromStates: readonly WorkflowState[] =
      t.from === '*' ? WORKFLOW_STATES.filter((s) => !TERMINAL_STATES.includes(s)) : t.from;
    for (const from of fromStates) {
      adj[from].add(t.to);
    }
  }
  return adj;
}

function reachableFrom(start: WorkflowState): Set<WorkflowState> {
  const adj = buildAdjacency();
  const seen = new Set<WorkflowState>([start]);
  const queue: WorkflowState[] = [start];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const next of adj[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

describe('reachability', () => {
  it('every state is reachable from factFinding', () => {
    const reached = reachableFrom('factFinding');
    const unreachable = WORKFLOW_STATES.filter((s) => !reached.has(s));
    expect(unreachable, `unreachable states from factFinding: ${unreachable.join(', ')}`).toEqual(
      [],
    );
  });

  it('terminal states have no outgoing transitions in the graph', () => {
    const adj = buildAdjacency();
    for (const t of TERMINAL_STATES) {
      expect([...adj[t]], `terminal state '${t}' has outgoing edges`).toEqual([]);
    }
  });

  it('every non-terminal state has at least one outgoing transition (no dead-ends)', () => {
    const adj = buildAdjacency();
    for (const s of WORKFLOW_STATES) {
      if (TERMINAL_STATES.includes(s)) continue;
      expect(adj[s].size, `'${s}' has no outgoing transitions`).toBeGreaterThan(0);
    }
  });

  it('every transition target appears in WORKFLOW_STATES', () => {
    for (const t of TRANSITIONS) {
      expect(WORKFLOW_STATES, `target of '${t.name}' missing`).toContain(t.to);
    }
  });

  it('explicit-from transitions reference only known WORKFLOW_STATES', () => {
    for (const t of TRANSITIONS) {
      if (t.from === '*') continue;
      for (const f of t.from) {
        expect(WORKFLOW_STATES, `from of '${t.name}' references '${f}'`).toContain(f);
      }
    }
  });

  it('happy-path lifecycle is walkable end-to-end (lead → onboarding → first AR cycle)', () => {
    // Concrete user journey through every phase. Each row is a
    // (from, transitionName, to) triple; we assert the transition
    // exists and accepts that source/target.
    const happyPath: Array<[WorkflowState, WorkflowTransition['name'], WorkflowState]> = [
      // Phase 1 → 2
      ['factFinding', 'lockFactFind', 'draftingSOA'],
      // Phase 2 (with one amend round-trip)
      ['draftingSOA', 'sendSOAForReview', 'reviewingSOA'],
      ['reviewingSOA', 'requestSOAChanges', 'amendingSOA'],
      ['amendingSOA', 'resubmitSOA', 'reviewingSOA'],
      // Phase 2 → 3
      ['reviewingSOA', 'approveSOA', 'presentingSOA'],
      // Phase 3: DocuSign-driven tenant flip
      ['presentingSOA', 'recordClientSigned', 'welcomeCallScheduled'],
      // Phase 3 → 5
      ['welcomeCallScheduled', 'startImplementation', 'implementingAdvice'],
      // Phase 5 → 6
      ['implementingAdvice', 'confirmImplementation', 'waitingForAR'],
      // Phase 6 → 7 (cron)
      ['waitingForAR', 'autoFlagARDue', 'dueForAR'],
      // Phase 7 cadence
      ['dueForAR', 'bookAR', 'arBooked'],
      ['arBooked', 'requestARDocument', 'draftingAR'],
      ['draftingAR', 'sendARForReview', 'reviewingAR'],
      ['reviewingAR', 'approveAR', 'arComplete'],
      // Phase 7 → 5 cycle restart
      ['arComplete', 'recordARPackSigned', 'implementingAdvice'],
    ];

    for (const [from, name, to] of happyPath) {
      const t = TRANSITIONS.find((x) => x.name === name);
      expect(t, `missing transition '${name}'`).toBeDefined();
      expect(t!.to, `'${name}' does not target '${to}'`).toBe(to);
      const ok = t!.from === '*' ? !TERMINAL_STATES.includes(from) : t!.from.includes(from);
      expect(ok, `'${name}' cannot fire from '${from}'`).toBe(true);
    }
  });

  it('side branches are walkable (insurance amendment + ROA/EO + self-serve AR)', () => {
    const branches: Array<[WorkflowState, WorkflowTransition['name'], WorkflowState]> = [
      // ROA / EO off welcomeCallScheduled
      ['welcomeCallScheduled', 'requestROAEO', 'draftingROAEO'],
      ['draftingROAEO', 'sendROAEOForReview', 'reviewingROAEO'],
      ['reviewingROAEO', 'approveROAEO', 'implementingAdvice'],
      // Insurance amendment (onboarding)
      ['implementingAdvice', 'flagInsuranceAmendment', 'insuranceAmendment'],
      ['insuranceAmendment', 'requestInsuranceROAEO', 'draftingROAEO'],
      ['insuranceAmendment', 'resolveInsuranceAmendment', 'implementingAdvice'],
      // Insurance amendment (AR client bypass)
      ['implementingAdvice', 'flagInsuranceAmendmentAR', 'draftingAR'],
      // Self-serve AR
      ['arBooked', 'selfServeARComplete', 'arComplete'],
      // AR-due fires from implementingAdvice as well as waitingForAR
      ['implementingAdvice', 'autoFlagARDue', 'dueForAR'],
    ];

    for (const [from, name, to] of branches) {
      const t = TRANSITIONS.find((x) => x.name === name);
      expect(t, `missing transition '${name}'`).toBeDefined();
      expect(t!.to, `'${name}' does not target '${to}'`).toBe(to);
      const ok = t!.from === '*' ? !TERMINAL_STATES.includes(from) : t!.from.includes(from);
      expect(ok, `'${name}' cannot fire from '${from}'`).toBe(true);
    }
  });

  it('lost is reachable from every lead-gen-owned non-terminal state', () => {
    const markLost = TRANSITIONS.find((t) => t.name === 'markLost')!;
    expect(markLost.to).toBe('lost');
    for (const state of [
      'factFinding',
      'draftingSOA',
      'reviewingSOA',
      'amendingSOA',
      'presentingSOA',
    ] as const) {
      const ok =
        markLost.from === '*' ? !TERMINAL_STATES.includes(state) : markLost.from.includes(state);
      expect(ok, `markLost should fire from '${state}'`).toBe(true);
    }
  });
});
