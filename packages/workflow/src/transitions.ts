import type { Role } from '@advicelink/rbac';

import type { WorkflowState } from './states.js';

/**
 * Catalogue of every named transition in the client lifecycle.
 *
 * REBUILD_PLAN.md §5.4. The table is the single source of truth: the
 * XState machine in `clientWorkflow.ts`, the `canTransition` helper,
 * the workflow-events writer (lands in WP-7) and the model-based test
 * sweep all read from this array — never from prose.
 *
 * Naming convention: every transition name is a verb-phrase in
 * `camelCase` matching the plan exactly (`startFactFind`, `lockFactFind`,
 * etc.). Renaming a transition is a breaking change for stored
 * `workflow_events` rows, so it goes through a database migration.
 */
export type WorkflowTransitionName =
  | 'startFactFind'
  | 'flagFactFindReady'
  | 'handOffToAdvice'
  | 'lockFactFind'
  | 'sendToParaplanner'
  | 'claimByParaplanner'
  | 'releaseClaim'
  | 'firstSectionSaved'
  | 'sendForReview'
  | 'requestChanges'
  | 'resubmit'
  | 'presentSOA'
  | 'recordAcceptance'
  | 'recordNotProceeding'
  | 'startImplementation'
  | 'closeImplementation'
  | 'autoEnterServicing'
  | 'autoFlagARDue'
  | 'startARWizard'
  | 'finaliseARWizard'
  | 'sendARForReview'
  | 'presentAR'
  | 'completeAR'
  | 'startROAEOWizard'
  | 'sendROAEOForReview'
  | 'completeROAEO'
  | 'markLost'
  | 'offboard';

/**
 * Why a transition fired. `user` is the default — a role-gated user
 * action; `system` covers things the API initiates internally
 * (`firstSectionSaved` after the paraplanner saves a section); `cron`
 * covers BullMQ auto-transitions (`autoFlagARDue`,
 * `autoEnterServicing`).
 */
export type TransitionTrigger = 'user' | 'system' | 'cron';

export interface WorkflowTransition {
  /** Stable name written to `workflow_events.transition_name`. */
  name: WorkflowTransitionName;
  /** Source state(s). `'*'` means "any non-terminal state". */
  from: readonly WorkflowState[] | '*';
  to: WorkflowState;
  /**
   * Roles allowed to initiate the transition. Empty array means
   * `system` / `cron` only — no human role can fire it. Tenant +
   * platform super-admins always pass; that's enforced by
   * `canTransition`, not duplicated here.
   */
  allowedRoles: readonly Role[];
  trigger: TransitionTrigger;
  /**
   * Compliance hook — `markLost` and `offboard` mandate a non-empty
   * `reason` so audit trails read meaningfully (REBUILD_PLAN §5.4).
   * The guard is enforced in `canTransition` + the XState machine;
   * the table is the single declaration site.
   */
  requiresReason?: boolean;
}

/**
 * Terminal states — `'*'` source transitions cannot fire from these.
 * Centralised so adding a new closed state is a one-line change.
 */
export const TERMINAL_STATES: readonly WorkflowState[] = ['lost', 'notProceeding', 'offboarded'];

/**
 * Wildcard source. Adviser/lead-gen can `markLost` or `offboard` a
 * client from any non-terminal state.
 */
const WILDCARD = '*' as const;

export const TRANSITIONS: readonly WorkflowTransition[] = [
  // capture
  {
    name: 'startFactFind',
    from: ['newLead'],
    to: 'factFinding',
    allowedRoles: ['lead_gen'],
    trigger: 'user',
  },
  {
    name: 'flagFactFindReady',
    from: ['factFinding'],
    to: 'factFindReady',
    allowedRoles: ['lead_gen'],
    trigger: 'user',
  },
  {
    name: 'handOffToAdvice',
    from: ['factFindReady'],
    to: 'handedOffToAdvice',
    allowedRoles: ['lead_gen'],
    trigger: 'user',
  },

  // onboarding
  {
    name: 'lockFactFind',
    from: ['handedOffToAdvice'],
    to: 'factFindLocked',
    allowedRoles: ['adviser', 'uf_support'],
    trigger: 'user',
  },
  {
    name: 'sendToParaplanner',
    from: ['factFindLocked'],
    to: 'awaitingParaplanner',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },

  // drafting
  {
    name: 'claimByParaplanner',
    from: ['awaitingParaplanner'],
    to: 'paraplannerClaimed',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },
  {
    // The paraplanner can release voluntarily; the cron job
    // (`auto-paraplanner-release`, REBUILD_PLAN §5.5) fires the same
    // transition with trigger='cron'.
    name: 'releaseClaim',
    from: ['paraplannerClaimed'],
    to: 'awaitingParaplanner',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },
  {
    // Fired by the SOA Wizard service when the paraplanner saves the
    // first section. Never user-initiated.
    name: 'firstSectionSaved',
    from: ['paraplannerClaimed'],
    to: 'draftingSOA',
    allowedRoles: [],
    trigger: 'system',
  },
  {
    name: 'sendForReview',
    from: ['draftingSOA', 'amendingSOA'],
    to: 'reviewingSOA',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },
  {
    name: 'requestChanges',
    from: ['reviewingSOA'],
    to: 'amendingSOA',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    // `resubmit` and `sendForReview` collapse semantically when the
    // source is `amendingSOA` — keeping `resubmit` as a distinct
    // event lets the audit log capture the round-trip.
    name: 'resubmit',
    from: ['amendingSOA'],
    to: 'reviewingSOA',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },

  // presenting
  {
    name: 'presentSOA',
    from: ['reviewingSOA'],
    to: 'soaPresented',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    name: 'recordAcceptance',
    from: ['soaPresented'],
    to: 'soaAccepted',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    name: 'recordNotProceeding',
    from: ['soaPresented'],
    to: 'notProceeding',
    allowedRoles: ['adviser'],
    trigger: 'user',
    requiresReason: true,
  },

  // implementing
  {
    name: 'startImplementation',
    from: ['soaAccepted'],
    to: 'implementing',
    allowedRoles: ['ar_support'],
    trigger: 'user',
  },
  {
    name: 'closeImplementation',
    from: ['implementing'],
    to: 'implemented',
    allowedRoles: ['ar_support'],
    trigger: 'user',
  },
  {
    // Auto-immediate per §5.4. Worker fires this the moment
    // `closeImplementation` lands; modelled as a separate transition
    // so the audit log records the phase boundary explicitly.
    name: 'autoEnterServicing',
    from: ['implemented'],
    to: 'servicing',
    allowedRoles: [],
    trigger: 'system',
  },

  // servicing — AR cadence
  {
    // Cron `auto-ar-due` (BullMQ) fires this when `next_ar_date <= now()`.
    name: 'autoFlagARDue',
    from: ['servicing'],
    to: 'arDue',
    allowedRoles: [],
    trigger: 'cron',
  },
  {
    name: 'startARWizard',
    from: ['arDue'],
    to: 'arWizardActive',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },
  {
    name: 'finaliseARWizard',
    from: ['arWizardActive'],
    to: 'draftingAR',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },
  {
    name: 'sendARForReview',
    from: ['draftingAR'],
    to: 'reviewingAR',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },
  {
    name: 'presentAR',
    from: ['reviewingAR'],
    to: 'arPresented',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },
  {
    name: 'completeAR',
    from: ['arPresented'],
    to: 'servicing',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },

  // servicing — ROA / EO cadence
  {
    name: 'startROAEOWizard',
    from: ['servicing'],
    to: 'draftingROAEO',
    allowedRoles: ['adviser', 'ar_adviser'],
    trigger: 'user',
  },
  {
    name: 'sendROAEOForReview',
    from: ['draftingROAEO'],
    to: 'reviewingROAEO',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    name: 'completeROAEO',
    from: ['reviewingROAEO'],
    to: 'servicing',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },

  // closed — wildcards
  {
    name: 'markLost',
    from: WILDCARD,
    to: 'lost',
    allowedRoles: ['lead_gen', 'adviser'],
    trigger: 'user',
    requiresReason: true,
  },
  {
    name: 'offboard',
    from: WILDCARD,
    to: 'offboarded',
    allowedRoles: ['adviser', 'ar_support'],
    trigger: 'user',
    requiresReason: true,
  },
];

/** O(1) lookup by transition name. Built once at module load. */
export const TRANSITIONS_BY_NAME: ReadonlyMap<WorkflowTransitionName, WorkflowTransition> = new Map(
  TRANSITIONS.map((t) => [t.name, t]),
);

export function getTransition(name: WorkflowTransitionName): WorkflowTransition {
  const t = TRANSITIONS_BY_NAME.get(name);
  if (!t) throw new Error(`@advicelink/workflow: unknown transition '${name}'`);
  return t;
}

/**
 * `from === '*'` if the source is wildcard; otherwise an explicit
 * `from` array including only non-terminal states (a wildcard cannot
 * leave a terminal state — `lost → lost` etc. is meaningless).
 */
export function isFromMatch(transition: WorkflowTransition, current: WorkflowState): boolean {
  if (transition.from === WILDCARD) {
    return !TERMINAL_STATES.includes(current);
  }
  return transition.from.includes(current);
}
