import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import { isMarketingRole, type Role } from '@advicelink/rbac';
import { personalSchema, type Personal } from '@advicelink/schemas';

import type { TxDb } from '../../trpc/context.js';

/**
 * Create a new client row.
 *
 * Two callsites, one helper:
 *
 *   1. Lead-gen capture flow (`actor.role === 'lead_gen'`):
 *        - The lead-gen tenant owns the row at creation
 *          (`tenantId = actor.tenantId`).
 *        - `originating_lead_gen_tenant_id = actor.tenantId`.
 *        - `destination_advice_tenant_id` MUST be supplied and MUST
 *          have an active `lead_gen_grants` row pairing the two
 *          tenants. The grant lookup runs inside the same
 *          transaction so a freshly-revoked grant takes effect
 *          immediately.
 *
 *   2. Advice firm self-source flow (any advice role):
 *        - The advice tenant owns the row at creation
 *          (`tenantId = actor.tenantId`).
 *        - `originatingLeadGenTenantId = NULL`.
 *        - `destinationAdviceTenantId = actor.tenantId`.
 *
 * Other tenant kinds + cross-tenant input combinations are rejected
 * defensively even though the `clients_check_tenant_kinds` trigger
 * also fires — fast-fail with a meaningful 4xx beats a Postgres
 * trigger exception every time.
 */

export interface CreateClientInput {
  /** Initial Fact Find personal payload. firstName + surname are
   *  the minimum useful set; the lock check (§11.1) enforces more
   *  fields later. */
  personal: Partial<Personal>;
  /** Required when actor is lead-gen. */
  destinationAdviceTenantId?: string;
  actor: { id: string; role: Role; tenantId: string };
}

export interface CreatedClient {
  id: string;
  tenantId: string;
  originatingLeadGenTenantId: string | null;
  destinationAdviceTenantId: string;
  workflowState: string;
}

export async function createClient(tx: TxDb, input: CreateClientInput): Promise<CreatedClient> {
  const personalParsed = personalSchema.safeParse(input.personal ?? {});
  if (!personalParsed.success) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'personal payload failed validation',
      cause: personalParsed.error,
    });
  }

  const isLeadGen = isMarketingRole(input.actor.role);
  let activeOwnerTenantId: string;
  let originatingLeadGenTenantId: string | null;
  let destinationAdviceTenantId: string;

  if (isLeadGen) {
    if (!input.destinationAdviceTenantId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'destinationAdviceTenantId is required when a lead-gen user creates a client',
      });
    }
    // Cross-tenant lookups bypass RLS via SECURITY DEFINER helpers
    // defined in migrations/0008_lead_gen_validation.sql. The trigger
    // app_clients_check_tenant_kinds is a backstop on the INSERT, but
    // catching it here gives the caller a clean 4xx with a meaningful
    // message instead of a Postgres exception.
    const destinationRows = (await tx.execute(
      sql`SELECT * FROM app_lookup_tenant_for_grant(${input.destinationAdviceTenantId}::uuid)`,
    )) as unknown as Array<{ kind: string; status: string }>;
    const destination = destinationRows[0];
    if (!destination) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'destinationAdviceTenantId does not refer to a known tenant',
      });
    }
    if (destination.kind !== 'advice') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'destinationAdviceTenantId must reference an advice tenant',
      });
    }
    if (destination.status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'destinationAdviceTenantId tenant is not active',
      });
    }

    const grantRows = (await tx.execute(
      sql`SELECT app_has_active_lead_gen_grant(${input.actor.tenantId}::uuid, ${input.destinationAdviceTenantId}::uuid) AS has_grant`,
    )) as unknown as Array<{ has_grant: boolean }>;
    if (!grantRows[0]?.has_grant) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'No active lead_gen_grants row links your tenant to the destination advice tenant',
      });
    }

    activeOwnerTenantId = input.actor.tenantId;
    originatingLeadGenTenantId = input.actor.tenantId;
    destinationAdviceTenantId = input.destinationAdviceTenantId;
  } else {
    // Self-source: advice tenant owns from creation.
    if (
      input.destinationAdviceTenantId &&
      input.destinationAdviceTenantId !== input.actor.tenantId
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Self-sourced clients must use the actor tenant as the destination advice tenant',
      });
    }
    activeOwnerTenantId = input.actor.tenantId;
    originatingLeadGenTenantId = null;
    destinationAdviceTenantId = input.actor.tenantId;
  }

  const [created] = await tx
    .insert(clients)
    .values({
      tenantId: activeOwnerTenantId,
      originatingLeadGenTenantId,
      destinationAdviceTenantId,
      personal: personalParsed.data,
      createdBy: input.actor.id,
      updatedBy: input.actor.id,
    })
    .returning({
      id: clients.id,
      tenantId: clients.tenantId,
      originatingLeadGenTenantId: clients.originatingLeadGenTenantId,
      destinationAdviceTenantId: clients.destinationAdviceTenantId,
      workflowState: clients.workflowState,
    });
  if (!created) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'createClient: insert returned no row',
    });
  }
  return created;
}
