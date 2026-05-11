import { setup, type AnyStateMachine } from 'xstate';

import { canTransition, type WorkflowActor } from './canTransition.js';
import {
  TRANSITIONS,
  type WorkflowTransition,
  type WorkflowTransitionName,
} from './transitions.js';
import { TERMINAL_STATES, WORKFLOW_STATES, type WorkflowState } from './states.js';

/**
 * The canonical XState v5 machine for the client workflow. This file
 * is the artifact the plan calls "the machine" (REBUILD_PLAN §5) — but
 * the day-to-day validation logic lives in `canTransition.ts` and
 * delegates to the same TRANSITIONS table the machine is built from.
 *
 * Why both?
 *  - `canTransition` is pure data-driven and trivially callable from
 *    feature code, services, and the UI; no XState runtime required.
 *  - The machine is the input to:
 *    1. visualisations (Workflow Maps admin page, REBUILD_PLAN §6.27),
 *    2. model-based test sweeps (path enumeration via XState graph
 *       utilities; see `test/reachability.test.ts`),
 *    3. type-checked event narrowing in any future code that wants to
 *       use `createActor()` to drive the machine.
 *
 * Machine context: `lastActor` and `lastReason` are the bookkeeping
 * inputs that match `canTransition`'s `WorkflowActor` + `reason`. We
 * keep them on context so XState's `transition()` is a pure function
 * of `(state, event)` — feeding them via input on every send keeps the
 * machine reproducible.
 */

export interface ClientWorkflowContext {
  actor: WorkflowActor | null;
  reason: string | null;
}

/**
 * One event variant per named transition. Carrying `actor` + `reason`
 * on the event lets a single guard implementation check both.
 */
export type ClientWorkflowEvent = {
  [K in WorkflowTransitionName]: {
    type: K;
    actor: WorkflowActor;
    reason?: string;
    /** Marks system / cron-initiated events; bypasses the role check. */
    isSystem?: boolean;
  };
}[WorkflowTransitionName];

interface OnEntry {
  target: WorkflowState;
  guard: (input: { event: ClientWorkflowEvent }) => boolean;
}

/**
 * Builds the XState `states` config object by inverting TRANSITIONS:
 * for every (fromState, transitionName) pair, register an `on.{name}`
 * handler whose target is the transition's `to` and whose guard
 * delegates to `canTransition` so the rules stay defined exactly once.
 */
function buildStatesConfig(): Record<WorkflowState, { on: Record<string, OnEntry[]> }> {
  const config = {} as Record<WorkflowState, { on: Record<string, OnEntry[]> }>;
  for (const state of WORKFLOW_STATES) {
    config[state] = { on: {} };
  }

  for (const transition of TRANSITIONS) {
    const fromStates: WorkflowState[] =
      transition.from === '*'
        ? WORKFLOW_STATES.filter((s) => !TERMINAL_STATES.includes(s))
        : [...transition.from];

    for (const from of fromStates) {
      const entries = (config[from].on[transition.name] ??= []);
      entries.push({
        target: transition.to,
        guard: makeGuard(transition),
      });
    }
  }

  return config;
}

function makeGuard(
  transition: WorkflowTransition,
): (input: { event: ClientWorkflowEvent }) => boolean {
  return ({ event }) => {
    // The event carries the actor + reason; the subject's `from` state
    // is implicit (the machine only delivers this guard's event when
    // the source state matches). We synthesise a `subject` shape from
    // the transition's first allowed `from` so canTransition's
    // signature stays uniform.
    // For wildcard transitions, pick the first non-terminal state as
    // a synthetic anchor — canTransition's guard logic doesn't depend
    // on the specific source for wildcards beyond "is it terminal?".
    const fromState =
      transition.from === '*'
        ? WORKFLOW_STATES.find((s) => !TERMINAL_STATES.includes(s))
        : transition.from[0];
    if (!fromState) return false;
    const decision = canTransition(transition.name, { workflowState: fromState }, event.actor, {
      reason: event.reason,
      isSystem: event.isSystem,
    });
    return decision.ok;
  };
}

/**
 * The compiled state machine. `setup()` enables strict event typing in
 * XState v5; the actual transition guards are produced lazily so the
 * TRANSITIONS table can be re-edited without re-shaping the machine.
 */
export const clientWorkflowMachine: AnyStateMachine = setup({
  types: {
    context: {} as ClientWorkflowContext,
    events: {} as ClientWorkflowEvent,
  },
}).createMachine({
  id: 'clientWorkflow',
  // Lead-gen captures every client into `factFinding` via the lead-
  // creation form — there is no "newLead" pre-state in v3 (REBUILD_PLAN §5).
  initial: 'factFinding',
  context: { actor: null, reason: null },
  states: buildStatesConfig(),
});
