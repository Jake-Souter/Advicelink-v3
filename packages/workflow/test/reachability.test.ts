import { describe, expect, it } from 'vitest';

import { TRANSITIONS, type WorkflowTransition } from '../src/transitions.js';
import { WORKFLOW_STATES, type WorkflowState } from '../src/states.js';

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
      t.from === '*'
        ? WORKFLOW_STATES.filter((s) => s !== 'lost' && s !== 'notProceeding' && s !== 'offboarded')
        : t.from;
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
  it('every state is reachable from newLead', () => {
    const reached = reachableFrom('newLead');
    const unreachable = WORKFLOW_STATES.filter((s) => !reached.has(s));
    expect(unreachable, `unreachable states from newLead: ${unreachable.join(', ')}`).toEqual([]);
  });

  it('terminal states have no outgoing transitions in the graph', () => {
    const adj = buildAdjacency();
    expect([...adj.lost]).toEqual([]);
    expect([...adj.notProceeding]).toEqual([]);
    expect([...adj.offboarded]).toEqual([]);
  });

  it('every non-terminal state has at least one outgoing transition (no dead-ends)', () => {
    const adj = buildAdjacency();
    const terminals = new Set(['lost', 'notProceeding', 'offboarded']);
    for (const s of WORKFLOW_STATES) {
      if (terminals.has(s)) continue;
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

  it('happy-path lifecycle is walkable end-to-end', () => {
    // Concrete user journey: lead → … → arPresented → servicing
    // Every step is a transition that exists in the table.
    const happyPath: Array<[WorkflowState, WorkflowTransition['name'], WorkflowState]> = [
      ['newLead', 'startFactFind', 'factFinding'],
      ['factFinding', 'flagFactFindReady', 'factFindReady'],
      ['factFindReady', 'handOffToAdvice', 'handedOffToAdvice'],
      ['handedOffToAdvice', 'lockFactFind', 'factFindLocked'],
      ['factFindLocked', 'sendToParaplanner', 'awaitingParaplanner'],
      ['awaitingParaplanner', 'claimByParaplanner', 'paraplannerClaimed'],
      ['paraplannerClaimed', 'firstSectionSaved', 'draftingSOA'],
      ['draftingSOA', 'sendForReview', 'reviewingSOA'],
      ['reviewingSOA', 'presentSOA', 'soaPresented'],
      ['soaPresented', 'recordAcceptance', 'soaAccepted'],
      ['soaAccepted', 'startImplementation', 'implementing'],
      ['implementing', 'closeImplementation', 'implemented'],
      ['implemented', 'autoEnterServicing', 'servicing'],
      ['servicing', 'autoFlagARDue', 'arDue'],
      ['arDue', 'startARWizard', 'arWizardActive'],
      ['arWizardActive', 'finaliseARWizard', 'draftingAR'],
      ['draftingAR', 'sendARForReview', 'reviewingAR'],
      ['reviewingAR', 'presentAR', 'arPresented'],
      ['arPresented', 'completeAR', 'servicing'],
    ];

    for (const [from, name, to] of happyPath) {
      const t = TRANSITIONS.find((x) => x.name === name);
      expect(t, `missing transition '${name}'`).toBeDefined();
      expect(t!.to, `'${name}' does not target '${to}'`).toBe(to);
      const ok =
        t!.from === '*'
          ? from !== 'lost' && from !== 'notProceeding' && from !== 'offboarded'
          : t!.from.includes(from);
      expect(ok, `'${name}' cannot fire from '${from}'`).toBe(true);
    }
  });
});
