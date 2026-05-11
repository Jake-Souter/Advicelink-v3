import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql as drSql } from 'drizzle-orm';

import {
  createDbClient,
  withPlatformAdmin,
  withTenantContext,
  type Db,
  type DbClient,
} from '../src/client.js';
import { tenants, users, type NewTenant, type NewUser } from '../src/schema/index.js';

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
      tx.select().from(users).where(drSql`tenant_id IN (${tenantAId}, ${tenantBId})`),
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
