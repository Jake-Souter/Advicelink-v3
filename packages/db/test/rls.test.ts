import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql as drSql } from 'drizzle-orm';

import {
  createDbClient,
  withPlatformAdmin,
  withTenantContext,
  type Db,
  type DbClient,
} from '../src/client.js';
import {
  clients,
  leadGenGrants,
  tenants,
  users,
  workflowEvents,
  type NewTenant,
  type NewUser,
} from '../src/schema/index.js';

/**
 * Open a transaction as `app_user` (no GUCs) — what an unauthenticated
 * request would look like at the DB level. Used by the "no context"
 * tests below; without `SET LOCAL ROLE` we'd be running as Railway's
 * `postgres` superuser, which bypasses RLS and would falsely pass.
 */
async function withNoContext<T>(client: DbClient, fn: (tx: Db) => Promise<T>): Promise<T> {
  return client.db.transaction(async (tx) => {
    await tx.execute(drSql`SET LOCAL ROLE app_user`);
    return fn(tx);
  });
}

/**
 * RLS contract proof. These tests are the canonical answer to "is the
 * tenant_id GUC pattern actually preventing cross-tenant reads?". They
 * spin up two ephemeral tenants in the live dev DB, then prove:
 *
 *   1. With tenant A's GUC set, queries see only A's rows.
 *   2. Switching to tenant B's GUC sees only B's rows.
 *   3. Without ANY GUC, every query returns zero rows (RLS blocks).
 *   4. INSERTs without context are rejected.
 *   5. INSERTs with the wrong tenant_id are rejected.
 *   6. The platform_super_admin role bypasses isolation (escape hatch).
 *
 * Skipped when DATABASE_URL isn't available (CI fast-tier without DB).
 * On a developer laptop with `doppler run -- pnpm test`, they hit the
 * real Railway dev DB and clean up after themselves.
 */

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const skip = !databaseUrl;

describe.skipIf(skip)('RLS contract', () => {
  let client: DbClient;
  // Suffix every fixture with the test PID so parallel local runs don't collide
  // and a failed previous run can be re-cleaned safely.
  const runSlug = `rls-test-${process.pid}-${Date.now()}`;
  const slugA = `${runSlug}-a`;
  const slugB = `${runSlug}-b`;
  let tenantAId = '';
  let tenantBId = '';
  let userAId = '';
  let userBId = '';

  beforeAll(async () => {
    client = createDbClient(databaseUrl!, {
      max: 1,
      applicationName: 'advicelink-rls-test',
    });

    await withPlatformAdmin(client, async (tx) => {
      const [a] = await tx
        .insert(tenants)
        .values({
          slug: slugA,
          displayName: 'RLS Test Tenant A',
        } satisfies NewTenant)
        .returning({ id: tenants.id });
      const [b] = await tx
        .insert(tenants)
        .values({
          slug: slugB,
          displayName: 'RLS Test Tenant B',
        } satisfies NewTenant)
        .returning({ id: tenants.id });
      if (!a || !b) throw new Error('RLS setup: failed to seed test tenants');
      tenantAId = a.id;
      tenantBId = b.id;

      const [ua] = await tx
        .insert(users)
        .values({
          tenantId: tenantAId,
          firebaseUid: `${runSlug}-a-fbuid`,
          email: 'a@example.test',
          displayName: 'A User',
          role: 'tenant_super_admin',
        } satisfies NewUser)
        .returning({ id: users.id });
      const [ub] = await tx
        .insert(users)
        .values({
          tenantId: tenantBId,
          firebaseUid: `${runSlug}-b-fbuid`,
          email: 'b@example.test',
          displayName: 'B User',
          role: 'tenant_super_admin',
        } satisfies NewUser)
        .returning({ id: users.id });
      if (!ua || !ub) throw new Error('RLS setup: failed to seed test users');
      userAId = ua.id;
      userBId = ub.id;
    });
  });

  afterAll(async () => {
    if (!client) return;
    await withPlatformAdmin(client, async (tx) => {
      // Tear-down. Platform admin bypasses tenant isolation so this is safe.
      // Rely on FK ON DELETE CASCADE / RESTRICT semantics: delete users
      // first, then tenants. team_memberships would cascade if we'd seeded
      // any.
      await tx.delete(users).where(eq(users.tenantId, tenantAId));
      await tx.delete(users).where(eq(users.tenantId, tenantBId));
      await tx.delete(tenants).where(eq(tenants.id, tenantAId));
      await tx.delete(tenants).where(eq(tenants.id, tenantBId));
    });
    await client.sql.end({ timeout: 5 });
  });

  it('tenant A context sees only tenant A rows', async () => {
    const rows = await withTenantContext(
      client,
      { tenantId: tenantAId, userId: userAId, userRole: 'tenant_super_admin' },
      async (tx) => tx.select().from(users),
    );
    const tenantIds = new Set(rows.map((r) => r.tenantId));
    expect(tenantIds).toEqual(new Set([tenantAId]));
    expect(rows.some((r) => r.id === userAId)).toBe(true);
    expect(rows.some((r) => r.id === userBId)).toBe(false);
  });

  it('tenant B context sees only tenant B rows', async () => {
    const rows = await withTenantContext(
      client,
      { tenantId: tenantBId, userId: userBId, userRole: 'tenant_super_admin' },
      async (tx) => tx.select().from(users),
    );
    const tenantIds = new Set(rows.map((r) => r.tenantId));
    expect(tenantIds).toEqual(new Set([tenantBId]));
    expect(rows.some((r) => r.id === userBId)).toBe(true);
    expect(rows.some((r) => r.id === userAId)).toBe(false);
  });

  it('no context: queries return zero rows from tenant tables', async () => {
    // Open a fresh transaction WITHOUT setting any GUCs. Even though A and B
    // exist, RLS treats the principal as nobody and yields nothing.
    const rows = await withNoContext(client, (tx) =>
      tx
        .select()
        .from(users)
        .where(drSql`tenant_id IN (${tenantAId}, ${tenantBId})`),
    );
    expect(rows).toEqual([]);
  });

  it('no context: INSERT into a tenant-scoped table is rejected', async () => {
    await expect(
      withNoContext(client, (tx) =>
        tx.insert(users).values({
          tenantId: tenantAId,
          firebaseUid: `${runSlug}-rejectme-fbuid`,
          email: 'reject@example.test',
          displayName: 'Should Not Insert',
          role: 'tenant_super_admin',
        } satisfies NewUser),
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('cross-tenant INSERT (B context inserting A row) is rejected', async () => {
    await expect(
      withTenantContext(
        client,
        { tenantId: tenantBId, userId: userBId, userRole: 'tenant_super_admin' },
        (tx) =>
          tx.insert(users).values({
            tenantId: tenantAId, // wrong tenant!
            firebaseUid: `${runSlug}-cross-fbuid`,
            email: 'cross@example.test',
            displayName: 'Cross Tenant',
            role: 'tenant_super_admin',
          } satisfies NewUser),
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('platform_super_admin sees rows from every tenant', async () => {
    const rows = await withPlatformAdmin(client, async (tx) =>
      tx
        .select()
        .from(users)
        .where(drSql`tenant_id IN (${tenantAId}, ${tenantBId})`),
    );
    const tenantIds = new Set(rows.map((r) => r.tenantId));
    expect(tenantIds).toEqual(new Set([tenantAId, tenantBId]));
  });
});

/**
 * Dual-tenant `clients` RLS contract (WP-5.5 §2.6.3 + WP-6.1).
 *
 * Spins up three tenants — a lead-gen agency, the destination advice
 * firm it has been granted, and an unrelated advice firm — plus a
 * client owned by lead-gen and destined for the advice firm. Then
 * proves:
 *
 *   1. Both named partner tenants can read the row; the unrelated
 *      tenant cannot.
 *   2. Pre-handoff (tenant_id = lead-gen): both partners can write;
 *      unrelated cannot.
 *   3. Post-handoff (tenant_id = advice): only the advice tenant can
 *      write; lead-gen retains read-only access.
 *   4. The `clients_tenant_is_named_partner` CHECK constraint blocks
 *      bogus active-owner values.
 *   5. The `app_clients_sync_phase` trigger keeps `workflow_phase` in
 *      lockstep with `workflow_state`.
 *   6. `workflow_events` accepts cross-tenant inserts (advice actor
 *      writing on a lead-gen-owned client during SOA Production).
 *   7. TFN encryption round-trips through `app_encrypt_tfn` /
 *      `app_decrypt_tfn` with a per-tenant key.
 */
describe.skipIf(skip)('Clients dual-tenant RLS contract', () => {
  let client: DbClient;
  const runSlug = `clients-rls-${process.pid}-${Date.now()}`;
  let leadGenTenantId = '';
  let adviceTenantId = '';
  let strangerTenantId = '';
  let leadGenUserId = '';
  let adviceUserId = '';
  let strangerUserId = '';

  beforeAll(async () => {
    client = createDbClient(databaseUrl!, {
      max: 1,
      applicationName: 'advicelink-clients-rls-test',
      // Deterministic test-only master key. Real prod key lives in Doppler.
      tfnMasterKey: 'test-master-key-do-not-use-in-prod',
    });

    await withPlatformAdmin(client, async (tx) => {
      const seeded = await tx
        .insert(tenants)
        .values([
          {
            slug: `${runSlug}-leadgen`,
            displayName: 'Lead Gen Agency',
            kind: 'lead_gen',
          } satisfies NewTenant,
          {
            slug: `${runSlug}-advice`,
            displayName: 'Destination Advice Firm',
            kind: 'advice',
          } satisfies NewTenant,
          {
            slug: `${runSlug}-stranger`,
            displayName: 'Unrelated Advice Firm',
            kind: 'advice',
          } satisfies NewTenant,
        ])
        .returning({ id: tenants.id, slug: tenants.slug });
      leadGenTenantId = seeded.find((t) => t.slug === `${runSlug}-leadgen`)!.id;
      adviceTenantId = seeded.find((t) => t.slug === `${runSlug}-advice`)!.id;
      strangerTenantId = seeded.find((t) => t.slug === `${runSlug}-stranger`)!.id;

      const usersSeeded = await tx
        .insert(users)
        .values([
          {
            tenantId: leadGenTenantId,
            firebaseUid: `${runSlug}-leadgen-fbuid`,
            email: 'leadgen@example.test',
            displayName: 'Lead Gen User',
            role: 'lead_gen',
          } satisfies NewUser,
          {
            tenantId: adviceTenantId,
            firebaseUid: `${runSlug}-advice-fbuid`,
            email: 'advice@example.test',
            displayName: 'Advice Adviser',
            role: 'adviser',
          } satisfies NewUser,
          {
            tenantId: strangerTenantId,
            firebaseUid: `${runSlug}-stranger-fbuid`,
            email: 'stranger@example.test',
            displayName: 'Stranger Adviser',
            role: 'adviser',
          } satisfies NewUser,
        ])
        .returning({ id: users.id, tenantId: users.tenantId });
      leadGenUserId = usersSeeded.find((u) => u.tenantId === leadGenTenantId)!.id;
      adviceUserId = usersSeeded.find((u) => u.tenantId === adviceTenantId)!.id;
      strangerUserId = usersSeeded.find((u) => u.tenantId === strangerTenantId)!.id;

      await tx.insert(leadGenGrants).values({
        leadGenTenantId,
        adviceTenantId,
        grantedByUserId: adviceUserId,
      });
    });
  });

  afterAll(async () => {
    if (!client) return;
    // Cleanup goes through the raw `postgres` superuser connection
    // because:
    //   1. The `app_block_audit_delete` trigger on workflow_events
    //      blocks ANY DELETE — including the CASCADE from `clients`.
    //      We temporarily disable it. ALTER TABLE requires table
    //      owner privilege, which `app_user` does not have.
    //   2. Superusers bypass RLS, so cross-tenant clean-up does not
    //      fight the dual-tenant policy.
    // The disable/enable is wrapped in a transaction so a thrown
    // exception leaves the trigger re-enabled.
    await client.sql.begin(async (tx) => {
      await tx.unsafe(`ALTER TABLE workflow_events DISABLE TRIGGER workflow_events_no_delete`);
      try {
        await tx.unsafe(
          `DELETE FROM clients
                          WHERE tenant_id IN ($1, $2, $3)
                             OR destination_advice_tenant_id IN ($1, $2, $3)
                             OR originating_lead_gen_tenant_id IN ($1, $2, $3)`,
          [leadGenTenantId, adviceTenantId, strangerTenantId],
        );
        await tx.unsafe(
          `DELETE FROM lead_gen_grants
            WHERE lead_gen_tenant_id = $1 AND advice_tenant_id = $2`,
          [leadGenTenantId, adviceTenantId],
        );
        await tx.unsafe(`DELETE FROM users WHERE tenant_id IN ($1, $2, $3)`, [
          leadGenTenantId,
          adviceTenantId,
          strangerTenantId,
        ]);
        await tx.unsafe(`DELETE FROM tenants WHERE id IN ($1, $2, $3)`, [
          leadGenTenantId,
          adviceTenantId,
          strangerTenantId,
        ]);
      } finally {
        await tx.unsafe(`ALTER TABLE workflow_events ENABLE TRIGGER workflow_events_no_delete`);
      }
    });
    await client.sql.end({ timeout: 5 });
  });

  /** Spin up a fresh lead-gen-owned client for each test. Returns id. */
  async function createLeadGenOwnedClient(firstName: string, surname: string): Promise<string> {
    return withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      async (tx) => {
        const [row] = await tx
          .insert(clients)
          .values({
            tenantId: leadGenTenantId,
            originatingLeadGenTenantId: leadGenTenantId,
            destinationAdviceTenantId: adviceTenantId,
            personal: { firstName, surname },
            createdBy: leadGenUserId,
            updatedBy: leadGenUserId,
          })
          .returning({ id: clients.id });
        return row!.id;
      },
    );
  }

  it('lead-gen tenant (active owner) can read its own client', async () => {
    const id = await createLeadGenOwnedClient('Alice', 'LeadGenRead');
    const rows = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) => tx.select().from(clients).where(eq(clients.id, id)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayName).toBe('Alice LeadGenRead');
  });

  it('destination advice tenant can read the lead-gen-owned client (cross-tenant read)', async () => {
    const id = await createLeadGenOwnedClient('Bob', 'AdviceRead');
    const rows = await withTenantContext(
      client,
      { tenantId: adviceTenantId, userId: adviceUserId, userRole: 'adviser' },
      (tx) => tx.select().from(clients).where(eq(clients.id, id)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(id);
  });

  it('unrelated tenant cannot see the client at all', async () => {
    const id = await createLeadGenOwnedClient('Carol', 'StrangerRead');
    const rows = await withTenantContext(
      client,
      { tenantId: strangerTenantId, userId: strangerUserId, userRole: 'adviser' },
      (tx) => tx.select().from(clients).where(eq(clients.id, id)),
    );
    expect(rows).toEqual([]);
  });

  it('pre-handoff: advice tenant CAN write to a lead-gen-owned client (SOA Production window)', async () => {
    const id = await createLeadGenOwnedClient('Dave', 'PreHandoffWrite');
    const result = await withTenantContext(
      client,
      { tenantId: adviceTenantId, userId: adviceUserId, userRole: 'adviser' },
      (tx) =>
        tx
          .update(clients)
          .set({ workflowState: 'draftingSOA', updatedBy: adviceUserId })
          .where(eq(clients.id, id))
          .returning({ id: clients.id, state: clients.workflowState }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.state).toBe('draftingSOA');
  });

  it('pre-handoff: unrelated tenant CANNOT write', async () => {
    const id = await createLeadGenOwnedClient('Eve', 'StrangerWrite');
    const result = await withTenantContext(
      client,
      { tenantId: strangerTenantId, userId: strangerUserId, userRole: 'adviser' },
      (tx) =>
        tx
          .update(clients)
          .set({ workflowState: 'draftingSOA' })
          .where(eq(clients.id, id))
          .returning({ id: clients.id }),
    );
    // RLS makes the row invisible — the UPDATE matches zero rows
    // rather than throwing, which is the correct safe behaviour.
    expect(result).toEqual([]);
  });

  it('post-handoff: lead-gen retains READ access but loses WRITE access', async () => {
    const id = await createLeadGenOwnedClient('Frank', 'PostHandoff');
    // Simulate the recordClientSigned webhook: flip tenant_id to advice in
    // the same transaction as the workflow advance. We do this through
    // platform admin to mimic the worker's escape hatch.
    await withPlatformAdmin(client, async (tx) => {
      await tx
        .update(clients)
        .set({ tenantId: adviceTenantId, workflowState: 'welcomeCallScheduled' })
        .where(eq(clients.id, id));
    });

    // Lead-gen can still SELECT (it remains a named partner)
    const seenByLeadGen = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) => tx.select().from(clients).where(eq(clients.id, id)),
    );
    expect(seenByLeadGen).toHaveLength(1);

    // …but cannot UPDATE (no longer the active owner; not in pre-
    // handoff write window either)
    const writeResult = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) =>
        tx
          .update(clients)
          .set({ workflowState: 'lost', updatedBy: leadGenUserId })
          .where(eq(clients.id, id))
          .returning({ id: clients.id }),
    );
    expect(writeResult).toEqual([]);

    // Advice can both read and write now
    const writeAsAdvice = await withTenantContext(
      client,
      { tenantId: adviceTenantId, userId: adviceUserId, userRole: 'adviser' },
      (tx) =>
        tx
          .update(clients)
          .set({ workflowState: 'implementingAdvice', updatedBy: adviceUserId })
          .where(eq(clients.id, id))
          .returning({ id: clients.id, state: clients.workflowState }),
    );
    expect(writeAsAdvice[0]!.state).toBe('implementingAdvice');
  });

  it('CHECK constraint blocks an active-owner that is neither named partner', async () => {
    await expect(
      withPlatformAdmin(client, (tx) =>
        tx.insert(clients).values({
          tenantId: strangerTenantId, // not lead-gen, not destination — illegal
          originatingLeadGenTenantId: leadGenTenantId,
          destinationAdviceTenantId: adviceTenantId,
          personal: { firstName: 'Bad', surname: 'Owner' },
        }),
      ),
    ).rejects.toThrow(/clients_tenant_is_named_partner|check constraint/i);
  });

  it('app_clients_sync_phase trigger keeps workflow_phase in lockstep', async () => {
    const id = await createLeadGenOwnedClient('Grace', 'PhaseSync');
    // Insert defaulted to factFinding -> factFind
    const inserted = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) => tx.select().from(clients).where(eq(clients.id, id)),
    );
    expect(inserted[0]!.workflowState).toBe('factFinding');
    expect(inserted[0]!.workflowPhase).toBe('factFind');

    // UPDATE workflow_state to a state in a different phase; phase must follow.
    await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) =>
        tx
          .update(clients)
          .set({
            workflowState: 'reviewingSOA',
            // Pass a deliberately wrong phase to prove the trigger overrides it.
            workflowPhase: 'factFind',
          })
          .where(eq(clients.id, id)),
    );

    const after = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) => tx.select().from(clients).where(eq(clients.id, id)),
    );
    expect(after[0]!.workflowState).toBe('reviewingSOA');
    expect(after[0]!.workflowPhase).toBe('soaProduction');
  });

  it('workflow_events accepts a cross-tenant insert (advice actor on lead-gen-owned row)', async () => {
    const id = await createLeadGenOwnedClient('Henry', 'XTenantEvent');
    await withTenantContext(
      client,
      { tenantId: adviceTenantId, userId: adviceUserId, userRole: 'adviser' },
      async (tx) => {
        await tx.insert(workflowEvents).values({
          tenantId: leadGenTenantId, // active owner of the row
          actorTenantId: adviceTenantId, // who fired it
          clientId: id,
          fromState: 'reviewingSOA',
          toState: 'amendingSOA',
          transitionName: 'requestSOAChanges',
          trigger: 'user',
          actorId: adviceUserId,
        });
      },
    );

    // Lead-gen can read its own audit row
    const seen = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) => tx.select().from(workflowEvents).where(eq(workflowEvents.clientId, id)),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]!.transitionName).toBe('requestSOAChanges');
  });

  it('TFN encryption round-trips through the per-tenant SQL helpers', async () => {
    const id = await createLeadGenOwnedClient('Iris', 'TfnEncrypt');
    const plain = '123456782';

    await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      async (tx) => {
        await tx.execute(
          drSql`UPDATE clients
                   SET tfn_encrypted = app_encrypt_tfn(tenant_id, ${plain})
                 WHERE id = ${id}`,
        );
      },
    );

    // Read raw ciphertext
    const ciphertext = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) => tx.select({ tfn: clients.tfnEncrypted }).from(clients).where(eq(clients.id, id)),
    );
    expect(ciphertext[0]!.tfn).toMatch(/^-----BEGIN PGP MESSAGE-----/);
    expect(ciphertext[0]!.tfn).not.toContain(plain);

    // Round-trip
    const decrypted = await withTenantContext(
      client,
      { tenantId: leadGenTenantId, userId: leadGenUserId, userRole: 'lead_gen' },
      (tx) =>
        tx.execute(
          drSql`SELECT app_decrypt_tfn(tenant_id, tfn_encrypted) AS tfn
                  FROM clients WHERE id = ${id}`,
        ),
    );
    // postgres-js returns a result-like object; just the first row's tfn.
    const row = (decrypted as unknown as Array<{ tfn: string | null }>)[0];
    expect(row?.tfn).toBe(plain);
  });
});
