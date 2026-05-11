import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';

import { BrandThemeProvider } from '@advicelink/ui';
import { readyAdviceBrandBundle, type BrandBundle } from '@advicelink/branding';

import { trpc } from '../../lib/trpc';

/**
 * Resolves the tenant identified by `tenantSlug` (from the URL) into
 * its display name and brand bundle, then wraps the children with the
 * `BrandThemeProvider` so every Tailwind utility downstream uses the
 * tenant palette.
 *
 * The lookup hits the no-auth `tenants.publicLookup` procedure on the
 * tenant-prefixed mount (REBUILD_PLAN §2.5 + §10.7). While the request
 * is in flight we render a tenant-agnostic skeleton themed with the
 * launching tenant's bundle as a sensible default — there is exactly
 * one tenant at v1, and skipping the splash flash matters more than
 * theoretical multi-tenant correctness on the very first paint.
 */
export interface ResolvedTenant {
  id: string;
  slug: string;
  displayName: string;
  brandBundle: BrandBundle;
}

const TenantContext = createContext<ResolvedTenant | null>(null);

export interface TenantProviderProps {
  tenantSlug: string;
  /**
   * Rendered while the lookup is pending. Routes pass a branded
   * loading shell here so the spinner is themed even on cold load.
   */
  fallback?: ReactNode;
  /**
   * Rendered when the lookup fails — typically a "this tenant does
   * not exist or is suspended" screen owned by the route.
   */
  errorFallback?: (err: unknown) => ReactNode;
  children: ReactNode;
}

export function TenantProvider({
  tenantSlug,
  fallback,
  errorFallback,
  children,
}: TenantProviderProps): ReactElement {
  const query = trpc.tenants.publicLookup.useQuery(
    { slug: tenantSlug },
    {
      // Pre-auth lookups should NOT retry forever on 404 — we rely on
      // a fast NOT_FOUND to render the "unknown tenant" screen.
      retry: (failureCount, err) => {
        const code = (err as { data?: { code?: string } } | undefined)?.data?.code;
        if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'BAD_REQUEST') return false;
        return failureCount < 2;
      },
      staleTime: 5 * 60_000,
    },
  );

  const fallbackBrand = readyAdviceBrandBundle;

  const resolved = useMemo<ResolvedTenant | null>(() => {
    if (!query.data) return null;
    return {
      id: query.data.id,
      slug: query.data.slug,
      displayName: query.data.displayName,
      brandBundle: (query.data.brandBundle ?? fallbackBrand) as BrandBundle,
    };
  }, [query.data, fallbackBrand]);

  if (query.isPending) {
    return (
      <BrandThemeProvider brand={fallbackBrand}>
        {fallback ?? <div data-tenant-loading="true" />}
      </BrandThemeProvider>
    );
  }
  if (query.isError) {
    return (
      <BrandThemeProvider brand={fallbackBrand}>
        {errorFallback ? errorFallback(query.error) : <div data-tenant-error="true" />}
      </BrandThemeProvider>
    );
  }
  if (!resolved) {
    // Should be unreachable — react-query reports either pending,
    // error, or success. Defensive branch keeps the type narrowing
    // honest.
    return <BrandThemeProvider brand={fallbackBrand}>{null}</BrandThemeProvider>;
  }

  return (
    <TenantContext.Provider value={resolved}>
      <BrandThemeProvider brand={resolved.brandBundle}>{children}</BrandThemeProvider>
    </TenantContext.Provider>
  );
}

export function useTenant(): ResolvedTenant {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant() must be used inside <TenantProvider>');
  return ctx;
}
