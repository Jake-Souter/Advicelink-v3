import type { Role } from '@advicelink/rbac';

import { TERMINAL_STATES, type WorkflowState } from './states.js';

/**
 * Catalogue of every named transition in the client lifecycle.
 *
 * REBUILD_PLAN.md §5.4 (rewritten for WP-5.5 to match production).
 * The table is the single source of truth: the XState machine in
 * `clientWorkflow.ts`, the `canTransition` helper, the workflow_events
 * writer (lands in WP-7) and the model-based test sweep all read from
 * this array — never from prose.
 *
 * Naming convention: every transition name is a verb-phrase in
 * `camelCase` matching the production trigger label as closely as
 * possible. Renaming a transition is a breaking change for stored
 * `workflow_events` rows, so it goes through a database migration.
 */
export type WorkflowTransitionName =
  // Phase 1 → 2
  | 'lockFactFind'
  // Phase 2 (SOA Production loop)
  | 'sendSOAForReview'
  | 'requestSOAChanges'
  | 'resubmitSOA'
  // Phase 2 → 3
  | 'approveSOA'
  // Phase 3: DocuSign-driven tenant flip
  | 'recordClientSigned'
  // Phase 3 → 5
  | 'startImplementation'
  // Phase 3 → 4 (ROA / EO branch off welcomeCallScheduled)
  | 'requestROAEO'
  | 'sendROAEOForReview'
  | 'approveROAEO'
  // Phase 5 (insurance amendment side branch)
  | 'flagInsuranceAmendment'
  | 'requestInsuranceROAEO'
  | 'resolveInsuranceAmendment'
  // Phase 5 → 7 (AR-client insurance amendment bypass)
  | 'flagInsuranceAmendmentAR'
  // Phase 5 → 6
  | 'confirmImplementation'
  // Phase 5/6 → 7 (AR-due cron)
  | 'autoFlagARDue'
  // Phase 7 cadence
  | 'bookAR'
  | 'requestARDocument'
  | 'sendARForReview'
  | 'approveAR'
  | 'selfServeARComplete'
  // Phase 7 → 5: DocuSign-driven cycle restart on new CSA
  | 'recordARPackSigned'
  // Closed
  | 'markLost';

/**
 * Why a transition fired. `user` is a role-gated user action; `system`
 * covers things the API initiates internally (none in the v3 spec
 * today, kept for future use); `cron` covers BullMQ auto-transitions
 * (`autoFlagARDue`); `webhook` covers DocuSign-driven transitions
 * (`recordClientSigned`, `recordARPackSigned`).
 */
export type TransitionTrigger = 'user' | 'system' | 'cron' | 'webhook';

export interface WorkflowTransition {
  /** Stable name written to `workflow_events.transition_name`. */
  name: WorkflowTransitionName;
  /** Source state(s). `'*'` means "any non-terminal state". */
  from: readonly WorkflowState[] | '*';
  to: WorkflowState;
  /**
   * Roles allowed to initiate the transition. Empty array means the
   * trigger is non-user (system / cron / webhook) and no human role
   * can fire it. Tenant + platform super-admins always pass; that's
   * enforced by `canTransition`, not duplicated here.
   */
  allowedRoles: readonly Role[];
  trigger: TransitionTrigger;
  /**
   * Compliance hook — transitions whose business meaning warrants a
   * persisted explanation set this. The guard is enforced in
   * `canTransition` + the XState machine; the table is the single
   * declaration site.
   */
  requiresReason?: boolean;
}

/** Wildcard source. Used by transitions reachable from any non-terminal state. */
const WILDCARD = '*' as const;

/**
 * Source states from which lead-gen can fire `markLost` — every
 * non-terminal state lead-gen still has access to. Once the
 * DocuSign-driven `recordClientSigned` flips ownership to the advice
 * tenant, lead-gen loses access; an offboarding decision becomes an
 * admin/management deletion (out of band from the workflow).
 */
const LEAD_GEN_OWNED_STATES: readonly WorkflowState[] = [
  'factFinding',
  'draftingSOA',
  'reviewingSOA',
  'amendingSOA',
  'presentingSOA',
];

export const TRANSITIONS: readonly WorkflowTransition[] = [
  // ── Phase 1 → 2 ──────────────────────────────────────────────────
  {
    name: 'lockFactFind',
    from: ['factFinding'],
    to: 'draftingSOA',
    // Per the production spec ("Fact Find locked" — paraplanner gets
    // the client into their portal once the Fact Find is locked).
    // The Fact Find lock itself is a flag on the row, not a workflow
    // state; this transition fires when the paraplanner picks the
    // locked client up.
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },

  // ── Phase 2 (SOA Production loop) ────────────────────────────────
  {
    name: 'sendSOAForReview',
    from: ['draftingSOA'],
    to: 'reviewingSOA',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },
  {
    name: 'requestSOAChanges',
    from: ['reviewingSOA'],
    to: 'amendingSOA',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    // Modelled distinct from `sendSOAForReview` so the audit log can
    // tell first-pass from a re-pass round-trip ("Resubmitted").
    name: 'resubmitSOA',
    from: ['amendingSOA'],
    to: 'reviewingSOA',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },

  // ── Phase 2 → 3 ──────────────────────────────────────────────────
  {
    // Adviser approves the SOA; service layer also creates the
    // onboarding-pack draft in Envelopes as a side effect.
    name: 'approveSOA',
    from: ['reviewingSOA'],
    to: 'presentingSOA',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },

  // ── Phase 3: DocuSign-driven tenant flip ─────────────────────────
  {
    // The DocuSign webhook on CSA envelope completion fires this. It
    // is the moment ownership transfers from the lead-gen tenant to
    // the destination advice tenant — both the row's `tenant_id` and
    // the workflow state advance in the same transaction.
    name: 'recordClientSigned',
    from: ['presentingSOA'],
    to: 'welcomeCallScheduled',
    allowedRoles: [],
    trigger: 'webhook',
  },

  // ── Phase 3 → 5 ──────────────────────────────────────────────────
  {
    name: 'startImplementation',
    from: ['welcomeCallScheduled'],
    to: 'implementingAdvice',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },

  // ── Phase 3 → 4 (ROA / EO branch off welcomeCallScheduled) ───────
  {
    name: 'requestROAEO',
    from: ['welcomeCallScheduled'],
    to: 'draftingROAEO',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    name: 'sendROAEOForReview',
    from: ['draftingROAEO'],
    to: 'reviewingROAEO',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },
  {
    name: 'approveROAEO',
    from: ['reviewingROAEO'],
    to: 'implementingAdvice',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },

  // ── Phase 5 (insurance amendment side branch — onboarding only) ──
  {
    // Dashed in the visual graph — fires from insurance pipeline
    // step 2 (client changes) or step 6 (revised terms declined).
    name: 'flagInsuranceAmendment',
    from: ['implementingAdvice'],
    to: 'insuranceAmendment',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    name: 'requestInsuranceROAEO',
    from: ['insuranceAmendment'],
    to: 'draftingROAEO',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },
  {
    // Animated — pipeline resumes from paused step.
    name: 'resolveInsuranceAmendment',
    from: ['insuranceAmendment'],
    to: 'implementingAdvice',
    allowedRoles: ['adviser'],
    trigger: 'user',
  },

  // ── Phase 5 → 7 (AR-client insurance amendment bypass) ───────────
  {
    // AR-client clients amend insurance via the AR Wizard rather than
    // routing through `insuranceAmendment` (which is onboarding-only).
    name: 'flagInsuranceAmendmentAR',
    from: ['implementingAdvice'],
    to: 'draftingAR',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },

  // ── Phase 5 → 6 ──────────────────────────────────────────────────
  {
    // "Confirm & Update Baseline" — adviser/UF Support presses this
    // when implementation work is wrapped up. There is no in-app
    // reverse: a Manual Workflow Override in /admin is the only way
    // to roll the client back from waitingForAR.
    name: 'confirmImplementation',
    from: ['implementingAdvice'],
    to: 'waitingForAR',
    allowedRoles: ['adviser', 'uf_support'],
    trigger: 'user',
  },

  // ── Phase 5 / 6 → 7 (AR-due cron) ────────────────────────────────
  {
    // BullMQ cron `auto-ar-due` fires this on every client whose
    // `next_ar_due_date <= today` from EITHER `implementingAdvice` or
    // `waitingForAR`. Gated only on the date — legacy mid-
    // implementation clients also flow through after 10 months.
    // Client-side, AR Support / UF Support portals also fire on load
    // with a session ref to prevent duplicate updates.
    name: 'autoFlagARDue',
    from: ['implementingAdvice', 'waitingForAR'],
    to: 'dueForAR',
    allowedRoles: [],
    trigger: 'cron',
  },

  // ── Phase 7 cadence ──────────────────────────────────────────────
  {
    name: 'bookAR',
    from: ['dueForAR'],
    to: 'arBooked',
    allowedRoles: ['ar_support'],
    trigger: 'user',
  },
  {
    name: 'requestARDocument',
    from: ['arBooked'],
    to: 'draftingAR',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },
  {
    name: 'sendARForReview',
    from: ['draftingAR'],
    to: 'reviewingAR',
    allowedRoles: ['paraplanner'],
    trigger: 'user',
  },
  {
    name: 'approveAR',
    from: ['reviewingAR'],
    to: 'arComplete',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },
  {
    // AR adviser self-serves the AR Wizard, skipping
    // draftingAR / reviewingAR entirely. Dashed in the visual graph.
    name: 'selfServeARComplete',
    from: ['arBooked'],
    to: 'arComplete',
    allowedRoles: ['ar_adviser'],
    trigger: 'user',
  },

  // ── Phase 7 → 5: DocuSign-driven cycle restart ───────────────────
  {
    // The reviewing-AR approve creates a new AR Pack draft in
    // Envelopes; once the client signs that pack the DocuSign webhook
    // resets `last_ar_completed_date`, sets a new `next_ar_due_date`
    // (CSA signing date + 10 months), and lands the client back in
    // `implementingAdvice` to complete the cycle.
    name: 'recordARPackSigned',
    from: ['arComplete'],
    to: 'implementingAdvice',
    allowedRoles: [],
    trigger: 'webhook',
  },

  // ── Closed ───────────────────────────────────────────────────────
  {
    // "Client Lost" button in the lead-gen portal. Covers both
    // non-conversions and sign-refusals at presentingSOA. After
    // ownership flips at `recordClientSigned`, lead-gen no longer has
    // access to the client; an offboarding decision then becomes an
    // admin/management deletion (out of band from the workflow).
    name: 'markLost',
    from: LEAD_GEN_OWNED_STATES,
    to: 'lost',
    allowedRoles: ['lead_gen'],
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
 * `from` array. Wildcard cannot leave a terminal state.
 */
export function isFromMatch(transition: WorkflowTransition, current: WorkflowState): boolean {
  if (transition.from === WILDCARD) {
    return !TERMINAL_STATES.includes(current);
  }
  return transition.from.includes(current);
}
