import { Link } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@advicelink/api/trpc';

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
    <div data-portal-kanban>
      {buckets.map((bucket) => (
        <section key={bucket.key} data-portal-bucket>
          <header>
            <h2>{bucket.label}</h2>
            <span data-chip>{bucket.clients.length}</span>
          </header>
          <p>{bucket.description}</p>
          {bucket.clients.length === 0 ? (
            <div data-empty-state>
              <p>Nothing here right now.</p>
            </div>
          ) : (
            <ul data-portal-card-list>
              {bucket.clients.map((row) => (
                <li key={row.id} data-portal-card>
                  <header>
                    <Link
                      to="/t/$tenantSlug/clients/$clientId/fact-find"
                      params={{ tenantSlug, clientId: row.id }}
                      search={{ section: 'personal' }}
                    >
                      <strong>{row.displayName || '(unnamed)'}</strong>
                    </Link>
                    <span data-chip data-tone="accent">
                      {humaniseState(row.workflowState)}
                    </span>
                  </header>
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
                  {renderCardActions ? (
                    <div data-portal-card-actions>{renderCardActions(row, bucket.key)}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
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
