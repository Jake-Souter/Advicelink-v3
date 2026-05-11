import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Alert, PageHeader } from '@advicelink/ui';

import { AppShell } from '../components/AppShell';
import { PortalKanban } from '../portals/PortalKanban';
import { trpc } from '../../lib/trpc';

/**
 * UF Support Portal — REBUILD_PLAN §6.4. Pre-advised work queue:
 * Fact Find QA needed (locked Fact Finds), Implementation documents
 * outstanding (clients in implementing). Each card jumps straight
 * into the Fact Find for now; the document chase view lands with
 * WP-9 (document storage).
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/portal/uf-support')({
  component: UfSupportPortalPage,
});

function UfSupportPortalPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const portal = trpc.clients.listForPortal.useQuery({ portal: 'uf-support' });

  return (
    <AppShell tenantSlug={tenantSlug}>
      <PageHeader title="UF Support portal" />
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
