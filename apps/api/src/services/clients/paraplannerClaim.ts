import { TRPCError } from '@trpc/server';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import { auditLog, clients } from '@advicelink/db';
import type { Role } from '@advicelink/rbac';
import { PARAPLANNER_CLAIMABLE_STATES } from '@advicelink/workflow';

import type { TxDb } from '../../trpc/context.js';

/**
 * Paraplanner claim mechanic — REBUILD_PLAN §4.5.
 *
 * The claim is a column on `clients` (`claimed_paraplanner_id` +
 * `claimed_at`), NOT a workflow state. Claim and release leave
 * `workflow_state` untouched; only the two columns and an `audit_log`
 * row change.
 *
 * Both operations are short transactions so the auto-release cron
 * worker (lands with WP-12) and the portal mutations can race
 * without deadlock.
 *
 * Eligibility:
 *   - Claim is only allowed in `draftingSOA` / `amendingSOA`.
 *   - Claim is rejected when another paraplanner already holds the
 *     row; idempotent for the holder (re-claiming is a no-op).
 *   - Release clears the columns whether or not the workflow state
 *     is still in the SOA Production loop, but only the holder, the
 *     assigned adviser, or a tenant super-admin may force release.
 */

export interface ClaimParaplannerInput {
  clientId: string;
  actor: { id: string; role: Role; tenantId: string };
}

export interface ReleaseParaplannerInput {
  clientId: string;
  actor: { id: string; role: Role; tenantId: string };
  /** Audit reason; required when force-releasing another user's claim. */
  reason?: string;
}

export async function claimParaplanner(tx: TxDb, input: ClaimParaplannerInput): Promise<void> {
  if (input.actor.role !== 'paraplanner') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `role '${input.actor.role}' cannot claim a paraplanner slot`,
    });
  }

  const [row] = await tx
    .select({
      id: clients.id,
      tenantId: clients.tenantId,
      workflowState: clients.workflowState,
      claimedParaplannerId: clients.claimedParaplannerId,
    })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${input.clientId} not found` });
  }
  if (!(PARAPLANNER_CLAIMABLE_STATES as readonly string[]).includes(row.workflowState)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `client is in '${row.workflowState}'; can only claim in draftingSOA / amendingSOA`,
    });
  }
  if (row.claimedParaplannerId != null && row.claimedParaplannerId !== input.actor.id) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'client is already claimed by another paraplanner',
    });
  }

  // Atomic claim — second writer racing the same row loses on the
  // `claimed_paraplanner_id IS NULL` predicate and gets a 0-row update,
  // which we surface as CONFLICT to keep the UX consistent.
  const result = await tx
    .update(clients)
    .set({
      claimedParaplannerId: input.actor.id,
      claimedAt: sql`now()`,
      updatedBy: input.actor.id,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(clients.id, input.clientId),
        or(isNull(clients.claimedParaplannerId), eq(clients.claimedParaplannerId, input.actor.id)),
      ),
    )
    .returning({ id: clients.id });

  if (result.length === 0) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'client was claimed by another paraplanner moments ago',
    });
  }

  await tx.insert(auditLog).values({
    tenantId: row.tenantId,
    clientId: row.id,
    actorId: input.actor.id,
    type: 'paraplanner.claimed',
    payload: { workflowState: row.workflowState },
  });
}

export async function releaseParaplanner(tx: TxDb, input: ReleaseParaplannerInput): Promise<void> {
  const [row] = await tx
    .select({
      id: clients.id,
      tenantId: clients.tenantId,
      assignedAdviserId: clients.assignedAdviserId,
      claimedParaplannerId: clients.claimedParaplannerId,
    })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${input.clientId} not found` });
  }
  if (row.claimedParaplannerId == null) {
    return; // already released — idempotent
  }

  const isHolder = row.claimedParaplannerId === input.actor.id;
  const isPrivileged =
    input.actor.role === 'tenant_super_admin' ||
    input.actor.role === 'platform_super_admin' ||
    (input.actor.role === 'adviser' && row.assignedAdviserId === input.actor.id);

  if (!isHolder && !isPrivileged) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'only the claim holder, the assigned adviser, or a tenant super-admin can release',
    });
  }

  await tx
    .update(clients)
    .set({
      claimedParaplannerId: null,
      claimedAt: null,
      updatedBy: input.actor.id,
      updatedAt: sql`now()`,
    })
    .where(eq(clients.id, input.clientId));

  await tx.insert(auditLog).values({
    tenantId: row.tenantId,
    clientId: row.id,
    actorId: input.actor.id,
    type: isHolder ? 'paraplanner.released' : 'paraplanner.force_released',
    payload: { previousHolderId: row.claimedParaplannerId, reason: input.reason ?? null },
  });
}
