import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Postgres enums backing every typed text column on the v3 base tables.
 * These map 1:1 with `migrations/0001_base_tables.sql` `CREATE TYPE` statements.
 *
 * REBUILD_PLAN refs:
 * - User roles: §4.1
 * - Team families and types: §4.2 / §7.3
 * - Membership seats: §7.4
 * - Tenant statuses: §7.1
 */

export const userRole = pgEnum('user_role', [
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
]);

export const teamType = pgEnum('team_type', ['marketing', 'advisory', 'paraplanner_pool']);

export const membershipSeat = pgEnum('membership_seat', [
  'lead_gen',
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management',
]);

export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended']);

/**
 * Tenant kind discriminates the two B2B-SaaS shapes Advicelink v3
 * supports (REBUILD_PLAN §2.6, added in WP-5.5):
 *
 *  - `'advice'` — a financial advice firm (the legacy default; owns
 *    advisers, paraplanners, AR support, etc., and is the destination
 *    of every signed onboarding pack).
 *  - `'lead_gen'` — an external lead-generation agency that captures
 *    leads on behalf of one or more advice firms. Owns lead-gen users
 *    only; cross-tenant access to the destination advice firm is
 *    granted by `lead_gen_grants` rows.
 */
export const tenantKind = pgEnum('tenant_kind', ['advice', 'lead_gen']);

export const calendarProvider = pgEnum('calendar_provider', ['microsoft', 'google']);

/**
 * Mirrors `WORKFLOW_STATES` in `packages/workflow/src/states.ts`. Kept
 * in sync by hand — the workflow package is the single source of truth
 * for the names, this enum simply teaches Postgres them. RLS on the
 * `clients` table reads `workflow_state` as an enum column for the
 * pre-handover SOA-production write window check (REBUILD_PLAN §2.6.3).
 *
 * The eslint-disable below is the one legitimate exception to the
 * `no-restricted-syntax` ban on stringly-typed workflow state arrays:
 * this IS the bridge declaration that the ban was written to police
 * the rest of the codebase against. Drift between this list and
 * `WORKFLOW_STATES` is caught by the workflow tests + the enum
 * comparison in @advicelink/db's typecheck.
 */
/* eslint-disable no-restricted-syntax */
export const workflowState = pgEnum('workflow_state', [
  'factFinding',
  'draftingSOA',
  'reviewingSOA',
  'amendingSOA',
  'presentingSOA',
  'welcomeCallScheduled',
  'draftingROAEO',
  'reviewingROAEO',
  'implementingAdvice',
  'insuranceAmendment',
  'waitingForAR',
  'dueForAR',
  'arBooked',
  'draftingAR',
  'reviewingAR',
  'arComplete',
  'lost',
]);

/** Mirrors `WORKFLOW_PHASES` in `packages/workflow/src/states.ts`. */
export const workflowPhase = pgEnum('workflow_phase', [
  'factFind',
  'soaProduction',
  'presentation',
  'postAdvice',
  'complete',
  'waiting',
  'annualReview',
  'closed',
]);
/* eslint-enable no-restricted-syntax */

/**
 * Trigger column on `workflow_events`. Mirrors `TransitionTrigger` in
 * `packages/workflow/src/transitions.ts`.
 */
export const transitionTrigger = pgEnum('transition_trigger', [
  'user',
  'system',
  'cron',
  'webhook',
]);

export type UserRole = (typeof userRole.enumValues)[number];
export type TeamType = (typeof teamType.enumValues)[number];
export type MembershipSeat = (typeof membershipSeat.enumValues)[number];
export type TenantStatus = (typeof tenantStatus.enumValues)[number];
export type TenantKind = (typeof tenantKind.enumValues)[number];
export type CalendarProvider = (typeof calendarProvider.enumValues)[number];
export type WorkflowStateEnum = (typeof workflowState.enumValues)[number];
export type WorkflowPhaseEnum = (typeof workflowPhase.enumValues)[number];
export type TransitionTriggerEnum = (typeof transitionTrigger.enumValues)[number];
