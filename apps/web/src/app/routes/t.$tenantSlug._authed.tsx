import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Stack } from '@advicelink/ui';

import { useAuth } from '../providers/AuthProvider';

/**
 * Pathless layout (`_authed`) — every route nested under here requires
 * a signed-in Firebase user. Anonymous traffic is redirected to the
 * tenant's login screen; the `loading` state renders a tenant-themed
 * splash so we don't briefly bounce signed-in users through the login
 * screen on every refresh while Firebase rehydrates from local
 * storage.
 *
 * The third defence layer (`Postgres RLS`) and the second layer
 * (`assertCanAccessClient`) still apply on every server call — this
 * guard is purely a UX optimisation, never a security boundary
 * (see `.cursor/rules/tenancy-and-rbac.mdc`).
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed')({
  component: AuthedLayout,
});

function AuthedLayout(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <Stack gap={2} align="center" data-page="splash">
        <span>Loading…</span>
      </Stack>
    );
  }
  if (status === 'signedOut') {
    return <Navigate to="/t/$tenantSlug/login" params={{ tenantSlug }} replace />;
  }
  return <Outlet />;
}
