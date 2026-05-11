import { Link } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@advicelink/api/trpc';
import { Cluster, EmptyState, Grid, Stack, StatusBadge, Surface } from '@advicelink/ui';

type ListForPortalOutput = inferRouterOutputs<AppRouter>['clients']['listForPortal'];
type PortalBucket = ListForPortalOutput[number];
type PortalClientRow = PortalBucket['clients'][number];

/**
 * `PortalKanban` — shared visual surface for every role-specific
 * portal. Buckets render side-by-side as columns; each card links
 * straight into the client's Fact Find as the default deep-link
 * target. Per-card secondary actions (Claim / Release / Mark Lost /
 * Hand off) are slotted in via the `renderCardActions` prop so the
 * shell stays the same across portals while role-specific buttons
 * stay role-specific.
 *
 * Drag-and-drop kanban interaction (REBUILD_PLAN §6.1) is deferred
 * to a follow-up; click-to-open is the v1 interaction.
 *
 * Each bucket is a `<Surface>` (Card) — those *are* a legitimate use
 * of the surface primitive: the buckets are visually distinct,
 * scrollable columns the user moves between. Each client inside the
 * bucket is a one-liner link with metadata, not its own card.
 */

export interface PortalKanbanProps {
  tenantSlug: string;
  buckets: ListForPortalOutput;
  /**
   * Optional per-card action slot. Receives the row + the bucket key
   * so role-specific buttons (e.g. Claim from the paraplanner
   * portal's `available` bucket) can branch on either.
   */
  renderCardActions?: (row: PortalClientRow, bucketKey: string) => ReactNode;
}

export function PortalKanban({
  tenantSlug,
  buckets,
  renderCardActions,
}: PortalKanbanProps): ReactElement {
  return (
    <Grid cols={3} gap={4}>
      {buckets.map((bucket) => (
        <Surface
          key={bucket.key}
          title={
            <Cluster gap={2}>
              <span>{bucket.label}</span>
              <StatusBadge tone="info">{bucket.clients.length}</StatusBadge>
            </Cluster>
          }
          description={bucket.description}
        >
          {bucket.clients.length === 0 ? (
            <EmptyState title="Nothing here right now." />
          ) : (
            <Stack gap={3} as="ul">
              {bucket.clients.map((row) => (
                <PortalCardRow
                  key={row.id}
                  row={row}
                  tenantSlug={tenantSlug}
                  bucketKey={bucket.key}
                  renderCardActions={renderCardActions}
                />
              ))}
            </Stack>
          )}
        </Surface>
      ))}
    </Grid>
  );
}

interface PortalCardRowProps {
  row: PortalClientRow;
  tenantSlug: string;
  bucketKey: string;
  renderCardActions?: (row: PortalClientRow, bucketKey: string) => ReactNode;
}

function PortalCardRow({
  row,
  tenantSlug,
  bucketKey,
  renderCardActions,
}: PortalCardRowProps): ReactElement {
  return (
    <li data-portal-card>
      <Stack gap={2}>
        <Cluster justify="between" gap={2}>
          <Link
            to="/t/$tenantSlug/clients/$clientId/fact-find"
            params={{ tenantSlug, clientId: row.id }}
            search={{ section: 'personal' }}
            data-portal-card-title
          >
            {row.displayName || '(unnamed)'}
          </Link>
          <StatusBadge tone="info">{humaniseState(row.workflowState)}</StatusBadge>
        </Cluster>
        <dl data-portal-card-meta>
          {row.nextArDate ? (
            <>
              <dt>Next AR</dt>
              <dd>{row.nextArDate}</dd>
            </>
          ) : null}
          {row.claimedAt ? (
            <>
              <dt>Claimed</dt>
              <dd>{formatDate(row.claimedAt)}</dd>
            </>
          ) : null}
          <dt>Last updated</dt>
          <dd>{formatDate(row.updatedAt)}</dd>
        </dl>
        {renderCardActions ? <Cluster gap={2}>{renderCardActions(row, bucketKey)}</Cluster> : null}
      </Stack>
    </li>
  );
}

const STATE_LABELS: Record<string, string> = {
  factFinding: 'Fact finding',
  draftingSOA: 'Drafting SOA',
  reviewingSOA: 'Reviewing SOA',
  amendingSOA: 'Amending SOA',
  presentingSOA: 'Presenting SOA',
  welcomeCallScheduled: 'Welcome call scheduled',
  draftingROAEO: 'Drafting ROA/EO',
  reviewingROAEO: 'Reviewing ROA/EO',
  implementingAdvice: 'Implementing advice',
  insuranceAmendment: 'Insurance amendment',
  waitingForAR: 'Waiting for AR',
  dueForAR: 'Due for AR',
  arBooked: 'AR booked',
  draftingAR: 'Drafting AR',
  reviewingAR: 'Reviewing AR',
  arComplete: 'AR complete',
  lost: 'Lost',
};

function humaniseState(state: string): string {
  return STATE_LABELS[state] ?? state;
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}
