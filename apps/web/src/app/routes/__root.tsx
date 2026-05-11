import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { useMemo, type ReactElement } from 'react';

import { AppProviders } from '../providers/AppProviders';

/**
 * The root route is intentionally minimal: it derives the active tenant
 * slug from the URL (path-prefix routing per REBUILD_PLAN §2.2) and
 * spins up the app-wide providers (`QueryClient`, `tRPCProvider`,
 * `AuthProvider`). Tenant-specific theme + tenant context lives one
 * level deeper in `t/$tenantSlug` so non-tenant routes (the bare `/`
 * redirector and any future global pages) don't pay for a tenant
 * lookup they never use.
 *
 * Subdomain resolution is the alternative branch in §2.2 — it stays
 * dormant until Cloudflare lands, at which point this file gains a
 * single `if (subdomain) return subdomain` step before falling back to
 * path inspection. No other code changes.
 */
const TENANT_PATH_RE = /^\/t\/([a-z0-9-]+)(?:\/|$)/;

function deriveTenantSlugFromPath(pathname: string): string | null {
  const match = TENANT_PATH_RE.exec(pathname);
  return match?.[1] ?? null;
}

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenantSlug = useMemo(() => deriveTenantSlugFromPath(pathname), [pathname]);

  return (
    <AppProviders tenantSlug={tenantSlug}>
      <Outlet />
    </AppProviders>
  );
}
