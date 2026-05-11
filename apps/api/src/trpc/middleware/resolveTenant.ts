import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

import {
  tenants,
  users,
  withPlatformAdmin,
  type DbClient,
  type Tenant,
  type User,
} from '@advicelink/db';

/**
 * Resolves "given this Firebase UID and the tenant slug from the URL,
 * which DB row in `users` is making the request?" — the centrepiece of
 * the auth pipeline.
 *
 * Reads run inside `withPlatformAdmin` so RLS bypass is explicit (we're
 * not yet inside a tenant scope; we're discovering it). The downstream
 * tRPC middleware then re-enters via `withTenantContext` for the actual
 * resolver query, so RLS protection is restored before any business
 * logic runs.
 */
export interface ResolvedTenantUser {
  user: User;
  tenant: Tenant;
}

export interface ResolveTenantInput {
  firebaseUid: string;
  tenantSlug: string;
}

export async function resolveTenantContext(
  client: DbClient,
  { firebaseUid, tenantSlug }: ResolveTenantInput,
): Promise<ResolvedTenantUser> {
  return withPlatformAdmin(client, async (tx) => {
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
    if (!tenant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Unknown tenant '${tenantSlug}'`,
      });
    }
    if (tenant.status !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Tenant '${tenantSlug}' is suspended`,
      });
    }

    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.tenantId, tenant.id)))
      .limit(1);
    if (!user) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Firebase user has no membership in tenant '${tenantSlug}'`,
      });
    }
    if (user.deactivatedAt !== null) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `User has been deactivated`,
      });
    }

    return { user, tenant };
  });
}
