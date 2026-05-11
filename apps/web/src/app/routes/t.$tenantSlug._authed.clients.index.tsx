import { Link, createFileRoute } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { AppShell } from '../components/AppShell';
import { trpc } from '../../lib/trpc';

/**
 * `/t/$tenantSlug/clients` — the clients list. RLS does the filtering;
 * `clients.list` simply returns whatever the active tenant context
 * makes visible. The lead-gen tenant sees its own clients (still in
 * pre-handoff phases) plus rows where it is a named partner; the
 * advice tenant sees its self-source clients plus inbound lead-gen
 * rows that have been handed over.
 *
 * The "New client" CTA routes to `/clients/new`; that screen branches
 * its form on `whoami.role` (lead_gen vs advice family).
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/clients/')({
  component: ClientsIndexPage,
});

function ClientsIndexPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const list = trpc.clients.list.useQuery({ limit: 100 });

  return (
    <AppShell tenantSlug={tenantSlug}>
      <header data-app-topbar>
        <h1>Clients</h1>
        <Link to="/t/$tenantSlug/clients/new" params={{ tenantSlug }} data-button="primary">
          New client
        </Link>
      </header>

      {list.isPending ? (
        <p>Loading clients…</p>
      ) : list.isError ? (
        <p data-banner data-tone="danger" role="alert">
          {list.error.message}
        </p>
      ) : list.data.length === 0 ? (
        <div data-empty-state>
          <h2>No clients yet</h2>
          <p>Create your first client to start a Fact Find.</p>
        </div>
      ) : (
        <div data-card>
          <table data-table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Workflow stage</th>
                <th>Phase</th>
                <th>Last updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.displayName || '(unnamed)'}</strong>
                  </td>
                  <td>
                    <span data-chip data-tone="accent">
                      {humaniseState(row.workflowState)}
                    </span>
                  </td>
                  <td>
                    <span data-chip>{humanisePhase(row.workflowPhase)}</span>
                  </td>
                  <td>{formatDate(row.updatedAt)}</td>
                  <td>
                    <Link
                      to="/t/$tenantSlug/clients/$clientId/fact-find"
                      params={{ tenantSlug, clientId: row.id }}
                      search={{ section: 'personal' }}
                      data-button="ghost"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

/**
 * Display labels for workflow states / phases. Stringly-typed
 * comparisons would violate the workflow-machine rule; the labels
 * here are pure presentation and never compared back, so a plain
 * lookup is fine.
 */
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

const PHASE_LABELS: Record<string, string> = {
  factFind: 'Fact Find',
  soaProduction: 'SOA Production',
  presentation: 'Presentation',
  postAdvice: 'Post-advice',
  complete: 'Complete',
  waiting: 'Waiting',
  annualReview: 'Annual Review',
  closed: 'Closed',
};

function humaniseState(state: string): string {
  return STATE_LABELS[state] ?? state;
}

function humanisePhase(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}
