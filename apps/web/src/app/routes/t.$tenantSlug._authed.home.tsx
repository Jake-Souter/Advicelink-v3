import { Navigate, createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Stack } from '@advicelink/ui';
import type { Role } from '@advicelink/rbac';

import { trpc } from '../../lib/trpc';

/**
 * Authed home — derives a default landing surface from the actor's
 * role and redirects there. The role → portal map mirrors the §4.3
 * page-access matrix and §6 portal definitions.
 *
 * Roles without a dedicated portal (legacy_import, anything missing
 * from the map) fall back to the clients list, which is universally
 * useful and RLS-filters automatically.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/home')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const whoami = trpc.auth.whoami.useQuery();

  if (whoami.isPending) {
    return (
      <Stack gap={2} align="center" data-page="splash">
        <span>Loading session…</span>
      </Stack>
    );
  }
  if (whoami.isError) {
    return (
      <Stack gap={2} align="center" data-page="splash">
        <p role="alert">Could not load session: {whoami.error.message}</p>
      </Stack>
    );
  }

  const target = defaultPortalPath(tenantSlug, whoami.data.user.role as Role);
  return <Navigate to={target} replace />;
}

/**
 * Map an actor role to its default portal landing path. Tenant /
 * platform super-admins land on the adviser portal because it gives
 * the broadest cross-tenant view at v1; the other surfaces remain
 * directly reachable via the sidebar.
 */
function defaultPortalPath(tenantSlug: string, role: Role): string {
  switch (role) {
    case 'lead_gen':
      return `/t/${tenantSlug}/portal/lead-gen`;
    case 'adviser':
      return `/t/${tenantSlug}/portal/adviser`;
    case 'paraplanner':
      return `/t/${tenantSlug}/portal/paraplanner`;
    case 'uf_support':
      return `/t/${tenantSlug}/portal/uf-support`;
    case 'ar_support':
      return `/t/${tenantSlug}/portal/ar-support`;
    case 'ar_adviser':
      return `/t/${tenantSlug}/portal/ar-adviser`;
    case 'management':
    case 'tenant_super_admin':
    case 'platform_super_admin':
      return `/t/${tenantSlug}/portal/adviser`;
    case 'legacy_import':
    default:
      return `/t/${tenantSlug}/clients`;
  }
}
