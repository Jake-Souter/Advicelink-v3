import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { AppShell } from '../components/AppShell';
import { PortalKanban } from '../portals/PortalKanban';
import { trpc } from '../../lib/trpc';

/**
 * AR Support Portal — REBUILD_PLAN §6.5. Post-advised work queue
 * with implementation + AR-window buckets driven by `next_ar_date`.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/portal/ar-support')({
  component: ArSupportPortalPage,
});

function ArSupportPortalPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const portal = trpc.clients.listForPortal.useQuery({ portal: 'ar-support' });

  return (
    <AppShell tenantSlug={tenantSlug}>
      <header data-app-topbar>
        <h1>AR Support portal</h1>
      </header>
      {portal.isPending ? (
        <p>Loading…</p>
      ) : portal.isError ? (
        <p data-banner data-tone="danger" role="alert">
          {portal.error.message}
        </p>
      ) : (
        <PortalKanban tenantSlug={tenantSlug} buckets={portal.data} />
      )}
    </AppShell>
  );
}
