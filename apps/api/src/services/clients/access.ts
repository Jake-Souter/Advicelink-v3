import { TRPCError } from '@trpc/server';

/**
 * `assertCanAccessClient` — application-layer enforcement of the
 * dual-tenant access rules from REBUILD_PLAN §2.6.3 / §4.4.
 *
 * RLS is the perimeter (a stranger tenant gets `[]` from any SELECT)
 * but the API layer also asserts so the error surface is meaningful:
 *   - cross-tenant strangers get a 404 (no information leak)
 *   - lead-gen actors trying to amend a post-handoff row get a 403
 *
 * The same helper is reused by every clients-touching route; passing
 * just the row's three tenant pointers keeps the signature small.
 */

import type { Role } from '@advicelink/rbac';
import { isAdviceRole, isMarketingRole, isAtLeastTenantAdmin } from '@advicelink/rbac';
import { isInPhase, isWorkflowState, type WorkflowState } from '@advicelink/workflow';

export interface ClientTenancySnapshot {
  id: string;
  /** Active owner tenant id. */
  tenantId: string;
  originatingLeadGenTenantId: string | null;
  destinationAdviceTenantId: string;
  /** Current workflow state — used to gate pre/post-handoff write checks. */
  workflowState: string;
}

export interface ActorSnapshot {
  id: string;
  tenantId: string;
  role: Role;
}

/**
 * Pre-handoff = phases 1 (factFind), 2 (soaProduction), 3 (presentation).
 * The `clients.tenant_id` flips from lead-gen to advice on the
 * `recordClientSigned` transition out of `presentingSOA`. Computed
 * via `isInPhase` rather than enumerated to comply with the
 * stringly-typed-workflow-state ban (REBUILD_PLAN §5).
 */
function isPreHandoffState(state: string): boolean {
  if (!isWorkflowState(state)) return false;
  const subject = { workflowState: state as WorkflowState };
  return (
    isInPhase('factFind', subject) ||
    isInPhase('soaProduction', subject) ||
    isInPhase('presentation', subject)
  );
}

/**
 * The actor MAY read this client. Throws `NOT_FOUND` (deliberate;
 * no information leak about cross-tenant rows) when not allowed.
 */
export function assertCanReadClient(client: ClientTenancySnapshot, actor: ActorSnapshot): void {
  if (isAtLeastTenantAdmin(actor.role)) return;
  const named =
    actor.tenantId === client.originatingLeadGenTenantId ||
    actor.tenantId === client.destinationAdviceTenantId;
  if (!named) {
    throw new TRPCError({ code: 'NOT_FOUND', message: `client ${client.id} not found` });
  }
}

/**
 * The actor MAY write this client. Used for Fact Find saves,
 * workflow advances, etc. Two layers:
 *   1. Cross-tenant access (same as read).
 *   2. Pre/post-handoff write window:
 *      - Pre-handoff (phases 1–3, lead-gen owns): both partners
 *        may write. Lead-gen amends are full edits; advice amends
 *        are typically SOA Production reads-and-edits.
 *      - Post-handoff (advice owns): lead-gen tenant loses write
 *        privilege at the application layer (RLS already enforces
 *        this at the row level via the dual-tenant write policy).
 */
export function assertCanWriteClient(client: ClientTenancySnapshot, actor: ActorSnapshot): void {
  assertCanReadClient(client, actor);
  if (isAtLeastTenantAdmin(actor.role)) return;

  if (actor.tenantId === client.tenantId) return; // active owner — always OK

  const isPreHandoff = isPreHandoffState(client.workflowState);
  if (
    isPreHandoff &&
    isAdviceRole(actor.role) &&
    actor.tenantId === client.destinationAdviceTenantId
  ) {
    return;
  }
  if (
    !isPreHandoff &&
    isMarketingRole(actor.role) &&
    actor.tenantId === client.originatingLeadGenTenantId
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message:
        'Lead-gen tenant has read-only access after the client has been handed off to the advice firm',
    });
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `Role '${actor.role}' from tenant '${actor.tenantId}' may not write client ${client.id}`,
  });
}
