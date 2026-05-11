import { createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { AppShell } from '../components/AppShell';
import { PortalKanban } from '../portals/PortalKanban';
import { trpc } from '../../lib/trpc';

/**
 * Adviser Portal — REBUILD_PLAN §6.2.
 *
 * Tabs (rendered as kanban columns): My Clients, Awaiting SOA Review,
 * AR Pipeline, ROA / EO Awaiting Review.
 *
 * `tenant_super_admin`, `management`, `ar_support`, and `ar_adviser`
 * also pass the role gate; the back-end widens the My Clients filter
 * for privileged actors so they see the whole tenant rather than just
 * their own assigned clients.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/portal/adviser')({
  component: AdviserPortalPage,
});

function AdviserPortalPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const portal = trpc.clients.listForPortal.useQuery({ portal: 'adviser' });

  return (
    <AppShell tenantSlug={tenantSlug}>
      <header data-app-topbar>
        <h1>Adviser portal</h1>
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
