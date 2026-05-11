import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';

import { AppShell } from '../components/AppShell';
import { PortalKanban } from '../portals/PortalKanban';
import { trpc } from '../../lib/trpc';

/**
 * Paraplanner Portal — REBUILD_PLAN §6.3.
 *
 * Two buckets: Available (unclaimed SOAs in the pool) and Claimed
 * (this paraplanner's active work). Per-card actions:
 *   - Available bucket → "Claim" calls `clients.claimParaplanner`.
 *   - Claimed bucket   → "Release" calls `clients.releaseParaplanner`.
 *
 * The claim is a column on `clients`, not a workflow state; the
 * cron-driven 48h auto-release (REBUILD_PLAN §4.5) lands with the
 * worker package in WP-12.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/portal/paraplanner')({
  component: ParaplannerPortalPage,
});

function ParaplannerPortalPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const portal = trpc.clients.listForPortal.useQuery({ portal: 'paraplanner' });
  const utils = trpc.useUtils();

  const claim = trpc.clients.claimParaplanner.useMutation({
    onSuccess: () => {
      void utils.clients.listForPortal.invalidate({ portal: 'paraplanner' });
    },
  });
  const release = trpc.clients.releaseParaplanner.useMutation({
    onSuccess: () => {
      void utils.clients.listForPortal.invalidate({ portal: 'paraplanner' });
    },
  });

  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <AppShell tenantSlug={tenantSlug}>
      <header data-app-topbar>
        <h1>Paraplanner portal</h1>
      </header>
      {actionError ? (
        <p data-banner data-tone="danger" role="alert" style={{ marginBottom: '1rem' }}>
          {actionError}
        </p>
      ) : null}
      {portal.isPending ? (
        <p>Loading…</p>
      ) : portal.isError ? (
        <p data-banner data-tone="danger" role="alert">
          {portal.error.message}
        </p>
      ) : (
        <PortalKanban
          tenantSlug={tenantSlug}
          buckets={portal.data}
          renderCardActions={(row, bucketKey) => {
            if (bucketKey === 'available') {
              return (
                <button
                  type="button"
                  data-button="primary"
                  disabled={claim.isPending}
                  onClick={() => {
                    setActionError(null);
                    claim.mutate(
                      { clientId: row.id },
                      { onError: (err) => setActionError(err.message) },
                    );
                  }}
                >
                  {claim.isPending ? 'Claiming…' : 'Claim'}
                </button>
              );
            }
            if (bucketKey === 'claimed') {
              return (
                <button
                  type="button"
                  data-button="ghost"
                  disabled={release.isPending}
                  onClick={() => {
                    setActionError(null);
                    release.mutate(
                      { clientId: row.id },
                      { onError: (err) => setActionError(err.message) },
                    );
                  }}
                >
                  {release.isPending ? 'Releasing…' : 'Release'}
                </button>
              );
            }
            return null;
          }}
        />
      )}
    </AppShell>
  );
}
