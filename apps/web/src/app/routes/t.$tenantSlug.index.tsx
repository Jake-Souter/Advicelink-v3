import { Navigate, createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Stack } from '@advicelink/ui';

import { useAuth } from '../providers/AuthProvider';

/**
 * `/t/$tenantSlug/` — auth-aware redirector.
 *
 * Anonymous traffic lands at `/login`; signed-in users land at the
 * placeholder `/home` page. Once the role-based portal entry-points
 * land in WP-7+ this component grows a small switch that picks the
 * correct portal (lead-gen / adviser / paraplanner / …) per
 * REBUILD_PLAN §4.5.
 */
export const Route = createFileRoute('/t/$tenantSlug/')({
  component: TenantRootRedirect,
});

function TenantRootRedirect(): ReactElement {
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
  return <Navigate to="/t/$tenantSlug/home" params={{ tenantSlug }} replace />;
}
