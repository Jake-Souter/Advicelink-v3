import { isInState, type WorkflowSubject } from './states.js';

/**
 * Pure predicates used by the BullMQ cron processors to decide whether
 * a given client should be auto-transitioned. The processor calls the
 * predicate per client, then issues the matching transition with
 * `isSystem: true`.
 *
 * The actual cron loop / BullMQ wiring lives in `apps/workers` and
 * lands in WP-7+ (REBUILD_PLAN §5.5). Keeping the predicates pure and
 * here means they are unit-testable without spinning up Redis.
 */

/**
 * `auto-ar-due`: clients in `servicing` whose `next_ar_date` has
 * elapsed move to `arDue`. Workers fire `autoFlagARDue` on each
 * matching client.
 *
 * The cron job is global; the per-client gate runs here so the
 * predicate is the single source of truth for "is this client due?".
 */
export interface AutoArDueSubject extends WorkflowSubject {
  nextArDate?: Date | string | null;
  next_ar_date?: Date | string | null;
}

export function shouldAutoFlagARDue(subject: AutoArDueSubject, now: Date = new Date()): boolean {
  if (!isInState('servicing', subject)) return false;
  const raw = subject.nextArDate ?? subject.next_ar_date;
  if (!raw) return false;
  const due = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() <= now.getTime();
}

/**
 * `auto-paraplanner-release`: a paraplanner who claimed a client but
 * has not made progress within the configured release window
 * relinquishes the claim. Per REBUILD_PLAN §4.5, the criteria are:
 *
 *   - the client is in `paraplannerClaimed` (not yet `draftingSOA`),
 *   - more than `releaseAfterMs` has elapsed since `claimed_at`.
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

export function shouldAutoReleaseParaplannerClaim(
  subject: AutoParaplannerReleaseSubject,
  options: AutoParaplannerReleaseOptions = {},
): boolean {
  if (!isInState('paraplannerClaimed', subject)) return false;
  const raw = subject.claimedAt ?? subject.claimed_at;
  if (!raw) return false;
  const claimed = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(claimed.getTime())) return false;
  const now = options.now ?? new Date();
  const threshold = options.releaseAfterMs ?? DEFAULT_PARAPLANNER_RELEASE_AFTER_MS;
  return now.getTime() - claimed.getTime() >= threshold;
}
