/**
 * Workflow phase + state catalogues.
 *
 * The state machine itself lives in `clientWorkflow.ts`; this file is
 * the typed source of truth that everything else (`transitions.ts`,
 * the machine, the canTransition helper, the lint rule) reads.
 *
 * Authoritative spec: REBUILD_PLAN.md §5 (rewritten for WP-5.5 to
 * match production WORKFLOW_NODES — 16 active states + 1 closed
 * across 8 phases).
 */

export const WORKFLOW_PHASES = [
  'factFind',
  'soaProduction',
  'presentation',
  'postAdvice',
  'complete',
  'waiting',
  'annualReview',
  'closed',
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];

/**
 * Every micro-state in the client lifecycle.
 *
 * Order intentionally mirrors REBUILD_PLAN §5.2 (and the production
 * WORKFLOW_NODES tuple) so a side-by-side diff stays readable. The
 * paraplanner claim is a column on `clients` (claimed_paraplanner_id),
 * NOT a workflow state — claiming and releasing a claim is data, not
 * a transition.
 */
export const WORKFLOW_STATES = [
  // 1. Fact Find — lead-gen captures and qualifies the lead
  'factFinding',

  // 2. SOA Production — paraplanner drafts, adviser reviews, loop
  'draftingSOA',
  'reviewingSOA',
  'amendingSOA',

  // 3. Presentation — lead-gen presents the SOA + onboarding pack;
  //    DocuSign webhook on CSA signature flips ownership to the
  //    advice tenant and lands the client in welcomeCallScheduled.
  'presentingSOA',
  'welcomeCallScheduled',

  // 4. Post-Advice (optional) — ROA / EO branch off welcomeCallScheduled
  'draftingROAEO',
  'reviewingROAEO',

  // 5. Complete — implementing the advice; insurance amendment is a
  //    side branch reachable only during onboarding.
  'implementingAdvice',
  'insuranceAmendment',

  // 6. Waiting — parking state once implementation is confirmed
  'waitingForAR',

  // 7. Annual Review — auto-flagged when nextArDueDate <= today,
  //    booked, drafted, reviewed, completed, then DocuSign webhook
  //    on the new CSA fires the cycle restart back to
  //    implementingAdvice.
  'dueForAR',
  'arBooked',
  'draftingAR',
  'reviewingAR',
  'arComplete',

  // 8. Closed — terminal for non-conversions and sign-refusals.
  //    Long-term offboarding is an admin/management action that
  //    deletes (or archives) the client row; not a workflow state.
  'lost',
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

/**
 * Static state → phase mapping. Kept explicit (rather than derived from
 * naming conventions) so phase ownership reads exactly like the plan
 * tables and a typo can never silently re-bucket a state.
 */
export const STATE_TO_PHASE: Readonly<Record<WorkflowState, WorkflowPhase>> = {
  factFinding: 'factFind',

  draftingSOA: 'soaProduction',
  reviewingSOA: 'soaProduction',
  amendingSOA: 'soaProduction',

  presentingSOA: 'presentation',
  welcomeCallScheduled: 'presentation',

  draftingROAEO: 'postAdvice',
  reviewingROAEO: 'postAdvice',

  implementingAdvice: 'complete',
  insuranceAmendment: 'complete',

  waitingForAR: 'waiting',

  dueForAR: 'annualReview',
  arBooked: 'annualReview',
  draftingAR: 'annualReview',
  reviewingAR: 'annualReview',
  arComplete: 'annualReview',

  lost: 'closed',
};

/**
 * Terminal states — `'*'` source transitions and most user actions
 * are blocked from these. Centralised so adding / renaming a closed
 * state stays a one-line change.
 */
export const TERMINAL_STATES: readonly WorkflowState[] = ['lost'];

/* ─────────────────────────────────────────────────────────────────
 * Named state-set helpers
 *
 * Several UI surfaces (portal kanbans, list filters) need to talk
 * about a *named subset* of the workflow that doesn't line up with
 * a single phase — e.g. "the SOA states a paraplanner can claim
 * from" (a strict subset of `soaProduction`), or "the active states
 * an adviser owns post-handoff" (which spans 3 phases).
 *
 * These named exports exist so call-sites elsewhere in the repo can
 * reference one identifier instead of inlining state literals (which
 * the `no-restricted-syntax` ESLint rule rightly bans). They sit in
 * `@advicelink/workflow` because the workflow package is the single
 * place allowed to enumerate state names as raw strings.
 *
 * Update REBUILD_PLAN §6 if the bucket ownership rules change.
 * ─────────────────────────────────────────────────────────────── */

/**
 * SOA states a paraplanner can claim FROM. `reviewingSOA` is
 * intentionally excluded — once the SOA is sent for review, the
 * adviser owns the work and a paraplanner shouldn't be able to take
 * the row mid-review.
 */
export const PARAPLANNER_CLAIMABLE_STATES: readonly WorkflowState[] = [
  'draftingSOA',
  'amendingSOA',
];

/**
 * Active states an adviser owns post-handoff. Used by the Adviser
 * Portal "My clients" bucket. Spans `presentation`, `complete`, and
 * `waiting` phases, hence a named set rather than a phase filter.
 */
export const ADVISER_ACTIVE_STATES: readonly WorkflowState[] = [
  'welcomeCallScheduled',
  'implementingAdvice',
  'insuranceAmendment',
  'waitingForAR',
];

/**
 * AR-pipeline buckets visible to the adviser portal. A strict subset
 * of `annualReview` excluding `draftingAR` (paraplanner-owned) and
 * `arComplete` (briefly-held terminal-of-cycle).
 */
export const AR_PIPELINE_STATES: readonly WorkflowState[] = ['dueForAR', 'arBooked', 'reviewingAR'];

/**
 * AR Wizard "in progress" set for the AR adviser portal — the AR
 * adviser is actively engaged from booked through reviewing.
 */
export const AR_WIZARD_IN_PROGRESS_STATES: readonly WorkflowState[] = [
  'arBooked',
  'draftingAR',
  'reviewingAR',
];

/**
 * The two states that count toward the "AR imminent" / "AR overdue"
 * windows — clients are post-advice but pre-AR-flagged. The cron
 * `auto-ar-due` watches this same set.
 */
export const PRE_AR_FLAG_STATES: readonly WorkflowState[] = ['implementingAdvice', 'waitingForAR'];

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

/** True if the state has no outbound transitions (terminal). */
export function isTerminalState(state: WorkflowState): boolean {
  return TERMINAL_STATES.includes(state);
}

/** Type guard for unknown strings. */
export function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === 'string' && (WORKFLOW_STATES as readonly string[]).includes(value);
}

/** Type guard for unknown strings. */
export function isWorkflowPhase(value: unknown): value is WorkflowPhase {
  return typeof value === 'string' && (WORKFLOW_PHASES as readonly string[]).includes(value);
}
