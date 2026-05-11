import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import { clients, workflowEvents } from '@advicelink/db';
import {
  canTransition,
  STATE_TO_PHASE,
  type WorkflowState,
  type WorkflowTransitionName,
} from '@advicelink/workflow';
import type { Role } from '@advicelink/rbac';

import type { TxDb } from '../../trpc/context.js';

/**
 * Execute a workflow transition end-to-end inside a single
 * transaction:
 *
 *   1. Read the current `workflow_state` for the client.
 *   2. Ask `@advicelink/workflow.canTransition` whether `actor` may
 *      fire `transitionName` from that state.
 *   3. Resolve the destination state from the transition definition.
 *   4. UPDATE `clients.workflow_state` (the `app_clients_sync_phase`
 *      trigger keeps `workflow_phase` and `state_changed_at` in
 *      lockstep).
 *   5. INSERT one row into `workflow_events` carrying actor + reason
 *      + payload.
 *
 * The two writes share the caller's `tx` so an exception aborts the
 * whole step. The destination state is derived from the transition
 * definition rather than supplied by the caller — there is one
 * authoritative `to` per transition name and trusting the input would
 * defeat the point of the registry.
 *
 * Returns the new `WorkflowState` so callers can immediately render
 * the next set of available transitions without a second query.
 */
import { getTransition } from '@advicelink/workflow';

export interface ExecuteTransitionInput {
  clientId: string;
  transitionName: WorkflowTransitionName;
  actor: { id: string; role: Role; tenantId: string };
  /** Required for transitions whose `requiresReason: true`. */
  reason?: string;
  /** Arbitrary structured payload to record on the event row. */
  payload?: Record<string, unknown>;
  /** Set true ONLY for trusted call-sites (cron workers, webhook
   *  handlers). Bypasses role check. Never derive from user input. */
  isSystem?: boolean;
  /** Active-owner tenant of the row at write time. Equals
   *  `clients.tenant_id`; cached on the input so the caller can
   *  pass it explicitly when it differs from `actor.tenantId`
   *  (cross-tenant lead-gen writes during SOA Production). */
  rowTenantId: string;
}

export interface ExecuteTransitionResult {
  fromState: WorkflowState;
  toState: WorkflowState;
}

export async function executeTransition(
  tx: TxDb,
  input: ExecuteTransitionInput,
): Promise<ExecuteTransitionResult> {
  const [row] = await tx
    .select({ id: clients.id, workflowState: clients.workflowState })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${input.clientId} not found` });
  }

  const decision = canTransition(
    input.transitionName,
    { workflowState: row.workflowState as WorkflowState },
    { role: input.actor.role },
    { reason: input.reason, isSystem: input.isSystem === true },
  );
  if (!decision.ok) {
    throw new TRPCError({
      code: decision.reason === 'role_not_allowed' ? 'FORBIDDEN' : 'BAD_REQUEST',
      message: decision.message,
      cause: { workflowError: decision.reason },
    });
  }

  const transition = getTransition(input.transitionName);
  const toState = transition.to as WorkflowState;

  await tx
    .update(clients)
    .set({
      workflowState: toState,
      // workflow_phase + state_changed_at maintained by the
      // app_clients_sync_phase trigger; setting workflowState alone
      // is enough.
      updatedBy: input.actor.id,
      updatedAt: sql`now()`,
    })
    .where(eq(clients.id, input.clientId));

  await tx.insert(workflowEvents).values({
    tenantId: input.rowTenantId,
    clientId: input.clientId,
    fromState: row.workflowState as WorkflowState,
    toState,
    transitionName: input.transitionName,
    trigger: input.isSystem === true ? 'system' : 'user',
    actorId: input.actor.id,
    actorTenantId: input.actor.tenantId,
    reason: input.reason ?? null,
    payload: input.payload ?? {},
  });

  return { fromState: row.workflowState as WorkflowState, toState };
}

/** Re-export so call-sites don't have to import from two places. */
export { STATE_TO_PHASE };
