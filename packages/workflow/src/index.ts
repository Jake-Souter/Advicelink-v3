/**
 * `@advicelink/workflow` — the client lifecycle state machine.
 *
 * Both the API and the web app import from here:
 *  - the web for chips, CTAs, and optimistic UX checks,
 *  - the API for authoritative validation before a workflow_events
 *    row is written and the `clients.workflow_state` column updated.
 *
 * **Stringly-typed status comparisons against `WorkflowState` values
 * outside this package are forbidden.** The lint rule
 * `no-stringly-typed-workflow-state` enforces this — use
 * `isInState`, `isInPhase`, or `canTransition` instead.
 *
 * REBUILD_PLAN.md §5.
 */

export {
  WORKFLOW_PHASES,
  WORKFLOW_STATES,
  STATE_TO_PHASE,
  isInState,
  isInPhase,
  isWorkflowPhase,
  isWorkflowState,
  phaseOf,
  type WorkflowPhase,
  type WorkflowState,
  type WorkflowSubject,
} from './states.js';

export {
  TRANSITIONS,
  TRANSITIONS_BY_NAME,
  TERMINAL_STATES,
  getTransition,
  isFromMatch,
  type TransitionTrigger,
  type WorkflowTransition,
  type WorkflowTransitionName,
} from './transitions.js';

export {
  canTransition,
  transitionsAvailable,
  type CanTransitionOptions,
  type TransitionDecision,
  type TransitionDenialReason,
  type WorkflowActor,
} from './canTransition.js';

export {
  shouldAutoFlagARDue,
  shouldAutoReleaseParaplannerClaim,
  DEFAULT_PARAPLANNER_RELEASE_AFTER_MS,
  type AutoArDueSubject,
  type AutoParaplannerReleaseOptions,
  type AutoParaplannerReleaseSubject,
} from './autoTransitions.js';

export {
  clientWorkflowMachine,
  type ClientWorkflowContext,
  type ClientWorkflowEvent,
} from './clientWorkflow.js';
