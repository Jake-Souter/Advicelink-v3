/**
 * Workflow phase + state catalogues.
 *
 * The state machine itself lives in `clientWorkflow.ts`; this file is
 * the typed source of truth that everything else (`transitions.ts`, the
 * machine, the canTransition helper, the lint rule) reads.
 *
 * REBUILD_PLAN.md §5.1 + §5.2.
 */

export const WORKFLOW_PHASES = [
  'capture',
  'onboarding',
  'drafting',
  'presenting',
  'implementing',
  'servicing',
  'closed',
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];

/**
 * Every micro-state in the client lifecycle. Order intentionally mirrors
 * REBUILD_PLAN §5.2 so a side-by-side diff stays readable.
 */
export const WORKFLOW_STATES = [
  // capture
  'newLead',
  'factFinding',
  'factFindReady',
  // onboarding
  'handedOffToAdvice',
  'factFindLocked',
  // drafting
  'awaitingParaplanner',
  'paraplannerClaimed',
  'draftingSOA',
  'reviewingSOA',
  'amendingSOA',
  // presenting
  'soaPresented',
  'soaAccepted',
  // implementing
  'implementing',
  'implemented',
  // servicing
  'servicing',
  'arDue',
  'arWizardActive',
  'draftingROAEO',
  'reviewingROAEO',
  'draftingAR',
  'reviewingAR',
  'arPresented',
  // closed
  'lost',
  'notProceeding',
  'offboarded',
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

/**
 * Static state → phase mapping. Kept explicit (rather than derived from
 * naming conventions) so phase ownership reads exactly like the plan
 * tables and a typo can never silently re-bucket a state.
 */
export const STATE_TO_PHASE: Readonly<Record<WorkflowState, WorkflowPhase>> = {
  newLead: 'capture',
  factFinding: 'capture',
  factFindReady: 'capture',

  handedOffToAdvice: 'onboarding',
  factFindLocked: 'onboarding',

  awaitingParaplanner: 'drafting',
  paraplannerClaimed: 'drafting',
  draftingSOA: 'drafting',
  reviewingSOA: 'drafting',
  amendingSOA: 'drafting',

  soaPresented: 'presenting',
  soaAccepted: 'presenting',

  implementing: 'implementing',
  implemented: 'implementing',

  servicing: 'servicing',
  arDue: 'servicing',
  arWizardActive: 'servicing',
  draftingROAEO: 'servicing',
  reviewingROAEO: 'servicing',
  draftingAR: 'servicing',
  reviewingAR: 'servicing',
  arPresented: 'servicing',

  lost: 'closed',
  notProceeding: 'closed',
  offboarded: 'closed',
};

/**
 * The minimum shape `isInPhase` / `isInState` / `canTransition` need
 * from a client. Callers pass the row directly — the helpers only ever
 * read `workflow_state`, never write or assume more than that.
 *
 * Both snake_case (DB) and camelCase (DTO) accepted so neither side of
 * the wire has to translate before calling. Helpers prefer camelCase
 * if both are set.
 */
export interface WorkflowSubject {
  workflowState?: WorkflowState;
  workflow_state?: WorkflowState;
}

function readWorkflowState(subject: WorkflowSubject): WorkflowState {
  const value = subject.workflowState ?? subject.workflow_state;
  if (!value) {
    throw new Error(
      '@advicelink/workflow: subject is missing `workflowState` (or `workflow_state`).',
    );
  }
  return value;
}

/** Exact micro-state check. Replaces stringly-typed `client.workflow_state === 'x'`. */
export function isInState(state: WorkflowState, subject: WorkflowSubject): boolean {
  return readWorkflowState(subject) === state;
}

/** Macro-phase check. Replaces stringly-typed array-of-states comparisons. */
export function isInPhase(phase: WorkflowPhase, subject: WorkflowSubject): boolean {
  return STATE_TO_PHASE[readWorkflowState(subject)] === phase;
}

/** Lookup helper — useful for chip rendering. */
export function phaseOf(state: WorkflowState): WorkflowPhase {
  return STATE_TO_PHASE[state];
}

/** Type guard for unknown strings. */
export function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === 'string' && (WORKFLOW_STATES as readonly string[]).includes(value);
}

/** Type guard for unknown strings. */
export function isWorkflowPhase(value: unknown): value is WorkflowPhase {
  return typeof value === 'string' && (WORKFLOW_PHASES as readonly string[]).includes(value);
}
