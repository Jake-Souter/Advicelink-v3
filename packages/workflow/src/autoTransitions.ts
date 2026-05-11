import { type WorkflowState, type WorkflowSubject } from './states.js';

/**
 * Pure predicates used by the BullMQ cron processors (and the
 * client-side AR Support / UF Support portals on load) to decide
 * whether a given client should be auto-transitioned. The processor
 * calls the predicate per client, then issues the matching transition
 * with `isSystem: true`.
 *
 * The actual cron loop / BullMQ wiring lives in `apps/workers` and
 * lands in WP-7+ (REBUILD_PLAN §5.5). Keeping the predicates pure and
 * here means they are unit-testable without spinning up Redis.
 */

/**
 * `auto-ar-due`: clients in `implementingAdvice` OR `waitingForAR`
 * whose `next_ar_due_date` has elapsed move to `dueForAR`. Workers
 * fire `autoFlagARDue` on each matching client.
 *
 * The cron job is global and runs hourly server-side; the AR Support
 * and UF Support portals also call this client-side on load with a
 * session ref to dedupe within a tab. The per-client gate runs here
 * so the predicate is the single source of truth for "is this client
 * due?".
 *
 * Gated only on the date — legacy mid-implementation clients also
 * flow through after 10 months. `implementation_confirmed` is NOT
 * checked.
 */
export interface AutoArDueSubject extends WorkflowSubject {
  nextArDueDate?: Date | string | null;
  next_ar_due_date?: Date | string | null;
}

const AR_DUE_SOURCE_STATES: readonly WorkflowState[] = ['implementingAdvice', 'waitingForAR'];

export function shouldAutoFlagARDue(subject: AutoArDueSubject, now: Date = new Date()): boolean {
  const state = subject.workflowState ?? subject.workflow_state;
  if (!state || !AR_DUE_SOURCE_STATES.includes(state)) return false;

  const raw = subject.nextArDueDate ?? subject.next_ar_due_date;
  if (!raw) return false;
  const due = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() <= now.getTime();
}

/**
 * `auto-paraplanner-release`: a paraplanner who claimed a client but
 * has not made progress within the configured release window
 * relinquishes the claim. The claim is a flag on `clients`
 * (`claimed_paraplanner_id`, `claimed_at`) — not a workflow state —
 * so the predicate gates on the SOA-production states the
 * paraplanner has active work in: `draftingSOA` and `amendingSOA`.
 *
 * `reviewingSOA` is excluded because once the SOA has been sent for
 * review the adviser holds the work; the paraplanner's claim sitting
 * idle is not a stalling signal.
 *
 * The threshold is configurable per tenant in WP-10's admin surface;
 * the predicate accepts it as an argument so the worker can resolve
 * it from `tenant.config` at call-time.
 */
export interface AutoParaplannerReleaseSubject extends WorkflowSubject {
  claimedAt?: Date | string | null;
  claimed_at?: Date | string | null;
}

export interface AutoParaplannerReleaseOptions {
  /** Stale-claim threshold in milliseconds. Tenant-configurable; defaults to 48 hours. */
  releaseAfterMs?: number;
  /** Override `now` for deterministic tests. */
  now?: Date;
}

export const DEFAULT_PARAPLANNER_RELEASE_AFTER_MS = 48 * 60 * 60 * 1000;

const PARAPLANNER_CLAIM_SOURCE_STATES: readonly WorkflowState[] = ['draftingSOA', 'amendingSOA'];

export function shouldAutoReleaseParaplannerClaim(
  subject: AutoParaplannerReleaseSubject,
  options: AutoParaplannerReleaseOptions = {},
): boolean {
  const state = subject.workflowState ?? subject.workflow_state;
  if (!state || !PARAPLANNER_CLAIM_SOURCE_STATES.includes(state)) return false;

  const raw = subject.claimedAt ?? subject.claimed_at;
  if (!raw) return false;
  const claimed = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(claimed.getTime())) return false;

  const now = options.now ?? new Date();
  const threshold = options.releaseAfterMs ?? DEFAULT_PARAPLANNER_RELEASE_AFTER_MS;
  return now.getTime() - claimed.getTime() >= threshold;
}

/**
 * AR cadence default — 10 months from CSA signing. Per the production
 * spec (legacy default is 10; the original plan said 12). Tenant-
 * overridable via `tenants.config.ar_default_offset_days` which the
 * service computes by adding `cadence_months` of months to the CSA
 * signing date in `Australia/Sydney`. Exposed here as a constant so
 * the date-math service has one source of truth.
 */
export const DEFAULT_AR_CADENCE_MONTHS = 10;

/**
 * Compute the next AR due date in `Australia/Sydney` time. Pure — no
 * IO. The DocuSign webhook handler calls this whenever a CSA envelope
 * completes (initial onboarding pack OR an AR Pack). Edge case:
 * adding 10 months to e.g. 31-Aug rolls forward to 30-Jun (fewer days
 * in the target month) — `Date#setMonth` handles this naturally.
 */
export function computeNextArDueDate(
  csaSignedAt: Date,
  cadenceMonths: number = DEFAULT_AR_CADENCE_MONTHS,
): Date {
  const next = new Date(csaSignedAt.getTime());
  next.setMonth(next.getMonth() + cadenceMonths);
  return next;
}
