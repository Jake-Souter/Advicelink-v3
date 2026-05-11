import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';

import { Alert, Button, PageHeader, Stack } from '@advicelink/ui';

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
      <PageHeader title="Paraplanner portal" />
      <Stack gap={4}>
        {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
        {portal.isPending ? (
          <Alert tone="neutral">Loading…</Alert>
        ) : portal.isError ? (
          <Alert tone="danger">{portal.error.message}</Alert>
        ) : (
          <PortalKanban
            tenantSlug={tenantSlug}
            buckets={portal.data}
            renderCardActions={(row, bucketKey) => {
              if (bucketKey === 'available') {
                return (
                  <Button
                    type="button"
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
                  </Button>
                );
              }
              if (bucketKey === 'claimed') {
                return (
                  <Button
                    type="button"
                    tone="ghost"
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
                  </Button>
                );
              }
              return null;
            }}
          />
        )}
      </Stack>
    </AppShell>
  );
}
