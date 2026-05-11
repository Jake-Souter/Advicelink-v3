import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { tenants, withPlatformAdmin } from '@advicelink/db';
import { isMarketingRole } from '@advicelink/rbac';

import { authedProcedure, publicProcedure, router } from '../trpc.js';

/**
 * `tenants.*` — pre-auth tenant discovery.
 *
 * `publicLookup` is the only tenant-table read available without a
 * Firebase token. It powers the login screen: the web app extracts the
 * tenant slug from the URL (`/t/:tenantSlug/login`), calls this query,
 * and uses the returned brand bundle to theme the login form before
 * any user has signed in.
 *
 * The handler runs inside `withPlatformAdmin` because there is no
 * tenant context yet — RLS would otherwise hide every row. We compensate
 * by returning ONLY the fields safe to expose pre-auth. Sensitive
 * fields (feature flags, primaryDomain, encKeyVersion) are NEVER
 * included in the response.
 *
 * Slug shape is `^[a-z0-9-]+$` to match `extractTenantSlug` in the
 * tRPC context factory; rejecting other shapes here keeps the
 * URL-shape contract enforced in exactly one place per request.
 */
const SLUG_RE = /^[a-z0-9-]+$/;

export const tenantsRouter = router({
  publicLookup: publicProcedure
    .input(
      z.object({
        slug: z
          .string()
          .min(1)
          .max(63)
          .regex(SLUG_RE, 'Tenant slug must be lowercase alphanumeric with dashes only'),
      }),
    )
    .query(async ({ input, ctx }) => {
      return withPlatformAdmin(ctx.dbClient, async (tx) => {
        const [tenant] = await tx
          .select({
            id: tenants.id,
            slug: tenants.slug,
            displayName: tenants.displayName,
            status: tenants.status,
            brandBundle: tenants.brandBundle,
          })
          .from(tenants)
          .where(eq(tenants.slug, input.slug))
          .limit(1);

        if (!tenant) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `No tenant found for slug '${input.slug}'`,
          });
        }
        if (tenant.status !== 'active') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Tenant '${input.slug}' is not active`,
          });
        }

        return {
          id: tenant.id,
          slug: tenant.slug,
          displayName: tenant.displayName,
          brandBundle: tenant.brandBundle,
        };
      });
    }),

  /**
   * List the destination advice firms the calling lead-gen tenant
   * holds active grants for. Used by the create-client form to
   * populate the destination dropdown.
   *
   * Returns `[]` for any non-lead-gen actor — the self-source flow
   * does not need this query (the form skips the dropdown entirely
   * for advice-family roles).
   *
   * The lookup uses a `SECURITY DEFINER` SQL function so the foreign
   * tenant rows on the `tenants` table are visible to the lead-gen
   * caller without weakening the tenants RLS policy.
   */
  listGrantedAdviceFirms: authedProcedure.query(async ({ ctx }) => {
    if (!isMarketingRole(ctx.user.role)) return [];
    const rows = (await ctx.db.execute(
      sql`SELECT id, slug, display_name AS "displayName"
            FROM app_list_granted_advice_firms(${ctx.tenant.id}::uuid)`,
    )) as unknown as Array<{ id: string; slug: string; displayName: string }>;
    return rows;
  }),
});
