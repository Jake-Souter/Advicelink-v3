import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Alert, PageHeader } from '@advicelink/ui';

import { AppShell } from '../components/AppShell';
import { PortalKanban } from '../portals/PortalKanban';
import { trpc } from '../../lib/trpc';

/**
 * AR Adviser Portal — REBUILD_PLAN §6.6. Buckets surface the AR
 * Wizard and ROA / EO Wizard work queues for the AR adviser
 * specifically.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/portal/ar-adviser')({
  component: ArAdviserPortalPage,
});

function ArAdviserPortalPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const portal = trpc.clients.listForPortal.useQuery({ portal: 'ar-adviser' });

  return (
    <AppShell tenantSlug={tenantSlug}>
      <PageHeader title="AR Adviser portal" />
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
