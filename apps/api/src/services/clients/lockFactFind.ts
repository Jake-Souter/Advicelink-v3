import { eq, sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import type { Role } from '@advicelink/rbac';

import type { TxDb } from '../../trpc/context.js';
import { loadFactFind } from '../factFind/load.js';
import { assertReadyToLock } from '../factFind/assertReadyToLock.js';
import { executeTransition } from '../workflow/transition.js';

/**
 * Lock the Fact Find for a client.
 *
 * Sequence:
 *   1. Load the row + completeness gate (`assertReadyToLock`).
 *   2. Stamp `fact_find_locked_at` (this is plain row data, not a
 *      workflow state — REBUILD_PLAN §11.1).
 *   3. Fire the `lockFactFind` workflow transition (factFinding →
 *      draftingSOA), which writes the workflow_events row.
 *
 * The order matters: stamping the timestamp before the transition
 * means a paraplanner picking up `draftingSOA` is guaranteed to see
 * `fact_find_locked_at != NULL`. Reverse order would leave a brief
 * window during which the row is in `draftingSOA` but lock-flag is
 * still null.
 */

export interface LockFactFindInput {
  clientId: string;
  actor: { id: string; role: Role; tenantId: string };
  /** Active-owner tenant of the row. Same as `actor.tenantId` for
   *  the lead-gen flow (the lead-gen agency locks before handoff). */
  rowTenantId: string;
}

export async function lockFactFind(tx: TxDb, input: LockFactFindInput) {
  const loaded = await loadFactFind(tx, input.clientId);
  assertReadyToLock(loaded);

  await tx
    .update(clients)
    .set({
      factFindLockedAt: sql`now()`,
      updatedBy: input.actor.id,
      updatedAt: sql`now()`,
    })
    .where(eq(clients.id, input.clientId));

  return executeTransition(tx, {
    clientId: input.clientId,
    transitionName: 'lockFactFind',
    actor: input.actor,
    rowTenantId: input.rowTenantId,
  });
}
