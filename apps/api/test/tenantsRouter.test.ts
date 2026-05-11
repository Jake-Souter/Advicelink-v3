import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import pino from 'pino';

import {
  createDbClient,
  tenants,
  withPlatformAdmin,
  type DbClient,
  type NewTenant,
} from '@advicelink/db';

import { appRouter } from '../src/trpc/router.js';
import type { BaseContext } from '../src/trpc/context.js';

/**
 * Integration tests for `tenants.publicLookup` — the only pre-auth read
 * of the tenants table. Hits the real Postgres instance via Drizzle so
 * RLS / `withPlatformAdmin` plumbing is exercised end-to-end.
 *
 * We bypass the Fastify adapter and call the router directly with a
 * synthetic context. That is the canonical pattern in the tRPC docs and
 * keeps these tests fast (no HTTP round trip).
 */
const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const skip = !databaseUrl;

describe.skipIf(skip)('tenants.publicLookup', () => {
  let client: DbClient;
  const runSlug = `tenants-router-${process.pid}-${Date.now()}`;
  const activeSlug = `${runSlug}-active`;
  const suspendedSlug = `${runSlug}-suspended`;
  let activeTenantId = '';
  let suspendedTenantId = '';

  function makeCaller(): ReturnType<typeof appRouter.createCaller> {
    const ctx: BaseContext = {
      reqId: 'test-req',
      logger: pino({ enabled: false }),
      tenantSlug: undefined,
      rawIdToken: undefined,
      dbClient: client,
    };
    return appRouter.createCaller(ctx);
  }

  beforeAll(async () => {
    client = createDbClient(databaseUrl!, {
      max: 1,
      applicationName: 'advicelink-api-test',
    });
    await withPlatformAdmin(client, async (tx) => {
      const [active] = await tx
        .insert(tenants)
        .values({
          slug: activeSlug,
          displayName: 'Active Tenant',
          brandBundle: { colours: { primary: '#0E2244', accent: '#2DD4BF' } },
        } satisfies NewTenant)
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
    });
  });

  afterAll(async () => {
    if (!client) return;
    await withPlatformAdmin(client, async (tx) => {
      await tx.delete(tenants).where(eq(tenants.id, activeTenantId));
      await tx.delete(tenants).where(eq(tenants.id, suspendedTenantId));
    });
    await client.sql.end({ timeout: 5 });
  });

  it('returns the brand bundle for an active tenant', async () => {
    const caller = makeCaller();
    const result = await caller.tenants.publicLookup({ slug: activeSlug });
    expect(result.id).toBe(activeTenantId);
    expect(result.slug).toBe(activeSlug);
    expect(result.displayName).toBe('Active Tenant');
    expect(result.brandBundle).toMatchObject({
      colours: { primary: '#0E2244', accent: '#2DD4BF' },
    });
    // Must not leak feature_flags / primary_domain / enc_key_version
    expect(Object.keys(result).sort()).toEqual(['brandBundle', 'displayName', 'id', 'slug']);
  });

  it('throws NOT_FOUND for an unknown slug', async () => {
    const caller = makeCaller();
    await expect(caller.tenants.publicLookup({ slug: `${runSlug}-missing` })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('throws FORBIDDEN when the tenant is suspended', async () => {
    const caller = makeCaller();
    await expect(caller.tenants.publicLookup({ slug: suspendedSlug })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects malformed slugs at the input boundary (BAD_REQUEST)', async () => {
    const caller = makeCaller();
    await expect(caller.tenants.publicLookup({ slug: 'NOT_A_SLUG_!@#' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
