import { isAtLeastTenantAdmin, type Role } from '@advicelink/rbac';

import {
  isFromMatch,
  TRANSITIONS,
  getTransition,
  type WorkflowTransitionName,
} from './transitions.js';
import { type WorkflowState, type WorkflowSubject } from './states.js';

/**
 * Reason an attempted transition was rejected. Surfaced verbatim by
 * the API's tRPC error envelope so the UI can switch on `reason` to
 * render targeted error states (REBUILD_PLAN §19.21).
 *
 * `unknown_transition` is a programming error (typo in a transition
 * name); the others are runtime conditions a user can hit.
 */
export type TransitionDenialReason =
  | 'unknown_transition'
  | 'invalid_from_state'
  | 'role_not_allowed'
  | 'reason_required'
  | 'system_only';

export type TransitionDecision =
  | { ok: true }
  | { ok: false; reason: TransitionDenialReason; message: string };

/**
 * Minimum actor shape needed to check role-based guards. Pass the
 * resolved tRPC `ctx.user` row directly — only `role` is read.
 */
export interface WorkflowActor {
  role: Role;
}

export interface CanTransitionOptions {
  /**
   * Free-form reason supplied by the user. Required for transitions
   * whose `requiresReason: true` (markLost, recordNotProceeding,
   * offboard). Whitespace-only strings count as missing.
   */
  reason?: string;
  /**
   * `true` for system / cron triggers — bypasses the role check (and
   * the `system_only` denial for transitions whose
   * `allowedRoles: []`). The API caller passes this only from
   * known-internal call-sites; never derived from request input.
   */
  isSystem?: boolean;
}

/**
 * Decide whether `transitionName` may fire from `subject.workflowState`
 * given `actor`. Pure — no IO, no DB. The API service layer calls this
 * before issuing the UPDATE, and the frontend calls the same function
 * to decide whether to render the matching CTA.
 */
export function canTransition(
  transitionName: WorkflowTransitionName,
  subject: WorkflowSubject,
  actor: WorkflowActor,
  options: CanTransitionOptions = {},
): TransitionDecision {
  let transition;
  try {
    transition = getTransition(transitionName);
  } catch {
    return {
      ok: false,
      reason: 'unknown_transition',
      message: `Unknown transition '${transitionName}'`,
    };
  }

  const current = subject.workflowState ?? subject.workflow_state;
  if (!current) {
    return {
      ok: false,
      reason: 'invalid_from_state',
      message: 'Subject is missing `workflowState`',
    };
  }
  if (!isFromMatch(transition, current as WorkflowState)) {
    return {
      ok: false,
      reason: 'invalid_from_state',
      message: `Transition '${transitionName}' cannot fire from state '${current}'`,
    };
  }

  if (options.isSystem !== true) {
    if (transition.allowedRoles.length === 0) {
      return {
        ok: false,
        reason: 'system_only',
        message: `Transition '${transitionName}' is system-initiated and cannot be triggered by users`,
      };
    }
    const allowed =
      isAtLeastTenantAdmin(actor.role) || transition.allowedRoles.includes(actor.role);
    if (!allowed) {
      return {
        ok: false,
        reason: 'role_not_allowed',
        message: `Role '${actor.role}' is not permitted to fire '${transitionName}' (allowed: ${transition.allowedRoles.join(', ')})`,
      };
    }
  }

  if (transition.requiresReason) {
    const trimmed = (options.reason ?? '').trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        reason: 'reason_required',
        message: `Transition '${transitionName}' requires a non-empty reason`,
      };
    }
  }

  return { ok: true };
}

/**
 * Enumerate the transitions that `actor` could fire on `subject` right
 * now. The frontend uses this to render only the CTAs the user is
 * actually allowed to click — no greyed-out "permission denied"
 * buttons.
 *
 * Reason-required transitions (`markLost`, `offboard`,
 * `recordNotProceeding`) are surfaced even though the actor hasn't
 * supplied a reason yet — the UI collects it via a follow-up modal on
 * click and re-checks `canTransition` server-side before commit.
 *
 * System-only transitions are filtered out by default so the UI never
 * shows them. Passing `includeSystem: true` flips them in (used by
 * the workers' job queues to enumerate fireable cron transitions).
 */
export function transitionsAvailable(
  subject: WorkflowSubject,
  actor: WorkflowActor,
  options: { includeSystem?: boolean } = {},
): WorkflowTransitionName[] {
  return TRANSITIONS.filter((t) => {
    const isSystem = t.allowedRoles.length === 0;
    if (!options.includeSystem && isSystem) return false;
    const decision = canTransition(t.name, subject, actor, {
      // Synthesise a reason so the reason-required guard passes; the
      // real reason is collected at click-time and re-verified
      // authoritatively on the server.
      reason: t.requiresReason ? '__pending_user_reason__' : undefined,
      isSystem: options.includeSystem === true && isSystem,
    });
    return decision.ok;
  }).map((t) => t.name);
}
