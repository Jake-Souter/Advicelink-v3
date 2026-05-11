import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';

import { AppShell } from '../components/AppShell';
import { PortalKanban } from '../portals/PortalKanban';
import { trpc } from '../../lib/trpc';

/**
 * GA Portal — REBUILD_PLAN §6.1. Lead-gen kanban with three
 * columns: New leads, Fact-Find-locked / drafting, and Presenting
 * SOA. Per-card "Mark lost" action calls the canonical `markLost`
 * workflow transition (must supply a reason).
 *
 * Drag-and-drop transitions (the legacy app's hero feature) are
 * deferred to a follow-up — for v1 the kanban is read + click-to-
 * open + mark-lost.
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/portal/lead-gen')({
  component: LeadGenPortalPage,
});

function LeadGenPortalPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const portal = trpc.clients.listForPortal.useQuery({ portal: 'lead-gen' });
  const utils = trpc.useUtils();
  const transition = trpc.clients.transition.useMutation({
    onSuccess: () => {
      void utils.clients.listForPortal.invalidate({ portal: 'lead-gen' });
      void utils.clients.list.invalidate();
    },
  });

  const [activeMarkLostId, setActiveMarkLostId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  function handleMarkLost(clientId: string): void {
    if (lostReason.trim().length === 0) {
      setActionError('Reason is required');
      return;
    }
    setActionError(null);
    transition.mutate(
      { clientId, transitionName: 'markLost', reason: lostReason.trim() },
      {
        onSuccess: () => {
          setActiveMarkLostId(null);
          setLostReason('');
        },
        onError: (err) => setActionError(err.message),
      },
    );
  }

  return (
    <AppShell tenantSlug={tenantSlug}>
      <header data-app-topbar>
        <h1>Lead Gen portal</h1>
      </header>
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
          renderCardActions={(row) => (
            <>
              {activeMarkLostId === row.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Reason for loss…"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    disabled={transition.isPending}
                  />
                  {actionError ? (
                    <span data-error style={{ fontSize: '0.75rem', color: '#DC2626' }}>
                      {actionError}
                    </span>
                  ) : null}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      data-button="primary"
                      onClick={() => handleMarkLost(row.id)}
                      disabled={transition.isPending}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      data-button="ghost"
                      onClick={() => {
                        setActiveMarkLostId(null);
                        setLostReason('');
                        setActionError(null);
                      }}
                      disabled={transition.isPending}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-button="ghost"
                  onClick={() => {
                    setActiveMarkLostId(row.id);
                    setLostReason('');
                    setActionError(null);
                  }}
                >
                  Mark lost
                </button>
              )}
            </>
          )}
        />
      )}
    </AppShell>
  );
}
