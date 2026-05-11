import { Outlet, createFileRoute } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';

import { Stack } from '@advicelink/ui';

import { TenantProvider } from '../providers/TenantProvider';

/**
 * `/t/$tenantSlug` layout route. Loads the tenant's brand bundle via
 * the no-auth `tenants.publicLookup` procedure and themes everything
 * downstream (login screen included). Renders `<Outlet />` so child
 * routes — `index`, `login`, `_authed/*` — pick up the resolved
 * tenant context via `useTenant()`.
 */
export const Route = createFileRoute('/t/$tenantSlug')({
  component: TenantLayout,
});

function TenantLayout(): ReactElement {
  const { tenantSlug } = Route.useParams();
  return (
    <TenantProvider
      tenantSlug={tenantSlug}
      fallback={<Splash>Loading…</Splash>}
      errorFallback={(err) => <UnknownTenantScreen err={err} slug={tenantSlug} />}
    >
      <Outlet />
    </TenantProvider>
  );
}

function Splash({ children }: { children: ReactNode }): ReactElement {
  return (
    <Stack gap={2} align="center" data-page="splash">
      {children}
    </Stack>
  );
}

function UnknownTenantScreen({ err, slug }: { err: unknown; slug: string }): ReactElement {
  // Forbidden / not-found: tenant either doesn't exist or has been
  // suspended. Either way the message is intentionally vague — we do
  // not enumerate tenant slugs to anonymous traffic.
  const code = (err as { data?: { code?: string } } | undefined)?.data?.code;
  const headline =
    code === 'FORBIDDEN' ? 'This workspace is not currently available' : 'Workspace not found';
  return (
    <Stack gap={3} align="center" data-page="splash">
      <h1>{headline}</h1>
      <p>
        We couldn&rsquo;t open <code>{slug}</code>. Check the URL or contact your administrator.
      </p>
    </Stack>
  );
}
