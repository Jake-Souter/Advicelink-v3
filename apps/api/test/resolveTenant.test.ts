import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDbClient,
  tenants,
  users,
  withPlatformAdmin,
  type DbClient,
  type NewTenant,
  type NewUser,
} from '@advicelink/db';
import { eq } from 'drizzle-orm';

import { resolveTenantContext } from '../src/trpc/middleware/resolveTenant.js';

const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const skip = !databaseUrl;

describe.skipIf(skip)('resolveTenantContext', () => {
  let client: DbClient;
  const runSlug = `tenant-resolver-${process.pid}-${Date.now()}`;
  const tenantSlug = `${runSlug}-active`;
  const suspendedSlug = `${runSlug}-suspended`;
  let activeTenantId = '';
  let suspendedTenantId = '';
  let activeUserId = '';
  let deactivatedUserId = '';
  const activeFirebaseUid = `${runSlug}-active-fbuid`;
  const deactivatedFirebaseUid = `${runSlug}-deactivated-fbuid`;
  const ghostFirebaseUid = `${runSlug}-ghost-fbuid`;

  beforeAll(async () => {
    client = createDbClient(databaseUrl!, {
      max: 1,
      applicationName: 'advicelink-api-test',
    });
    await withPlatformAdmin(client, async (tx) => {
      const [active] = await tx
        .insert(tenants)
        .values({ slug: tenantSlug, displayName: 'Active Tenant' } satisfies NewTenant)
        .returning({ id: tenants.id });
      const [suspended] = await tx
        .insert(tenants)
        .values({
          slug: suspendedSlug,
          displayName: 'Suspended Tenant',
          status: 'suspended',
        } satisfies NewTenant)
        .returning({ id: tenants.id });
      if (!active || !suspended) throw new Error('seed: tenants insert failed');
      activeTenantId = active.id;
      suspendedTenantId = suspended.id;

      const [activeUser] = await tx
        .insert(users)
        .values({
          tenantId: activeTenantId,
          firebaseUid: activeFirebaseUid,
          email: 'active@example.test',
          displayName: 'Active User',
          role: 'adviser',
        } satisfies NewUser)
        .returning({ id: users.id });
      const [deactivatedUser] = await tx
        .insert(users)
        .values({
          tenantId: activeTenantId,
          firebaseUid: deactivatedFirebaseUid,
          email: 'deactivated@example.test',
          displayName: 'Deactivated User',
          role: 'adviser',
          deactivatedAt: new Date(),
        } satisfies NewUser)
        .returning({ id: users.id });
      if (!activeUser || !deactivatedUser) throw new Error('seed: users insert failed');
      activeUserId = activeUser.id;
      deactivatedUserId = deactivatedUser.id;
    });
  });

  afterAll(async () => {
    if (!client) return;
    await withPlatformAdmin(client, async (tx) => {
      await tx.delete(users).where(eq(users.tenantId, activeTenantId));
      await tx.delete(users).where(eq(users.tenantId, suspendedTenantId));
      await tx.delete(tenants).where(eq(tenants.id, activeTenantId));
      await tx.delete(tenants).where(eq(tenants.id, suspendedTenantId));
    });
    await client.sql.end({ timeout: 5 });
  });

  it('resolves the user when slug + firebase_uid match an active tenant', async () => {
    const resolved = await resolveTenantContext(client, {
      firebaseUid: activeFirebaseUid,
      tenantSlug,
    });
    expect(resolved.tenant.id).toBe(activeTenantId);
    expect(resolved.tenant.slug).toBe(tenantSlug);
    expect(resolved.user.id).toBe(activeUserId);
    expect(resolved.user.role).toBe('adviser');
  });

  it('throws NOT_FOUND for an unknown tenant slug', async () => {
    await expect(
      resolveTenantContext(client, {
        firebaseUid: activeFirebaseUid,
        tenantSlug: `${runSlug}-does-not-exist`,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws FORBIDDEN when the tenant is suspended', async () => {
    await expect(
      resolveTenantContext(client, {
        firebaseUid: activeFirebaseUid,
        tenantSlug: suspendedSlug,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: /suspended/i });
  });

  it('throws FORBIDDEN when the firebase user has no row in this tenant', async () => {
    await expect(
      resolveTenantContext(client, {
        firebaseUid: ghostFirebaseUid,
        tenantSlug,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: /no membership/i });
  });

  it('throws FORBIDDEN when the user is deactivated', async () => {
    await expect(
      resolveTenantContext(client, {
        firebaseUid: deactivatedFirebaseUid,
        tenantSlug,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: /deactivated/i });
    // Sanity: the deactivated user does exist
    expect(deactivatedUserId).toBeTruthy();
  });
});
