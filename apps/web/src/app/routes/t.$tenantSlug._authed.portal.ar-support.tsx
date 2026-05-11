import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Alert, PageHeader } from '@advicelink/ui';

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
      <PageHeader title="AR Support portal" />
      {portal.isPending ? (
        <Alert tone="neutral">Loading…</Alert>
      ) : portal.isError ? (
        <Alert tone="danger">{portal.error.message}</Alert>
      ) : (
        <PortalKanban tenantSlug={tenantSlug} buckets={portal.data} />
      )}
    </AppShell>
  );
}
