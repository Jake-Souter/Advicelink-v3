import { Link, createFileRoute } from '@tanstack/react-router';
import { AlertTriangle, Loader2, Plus, Users } from 'lucide-react';
import type { ReactElement } from 'react';

import {
  Button,
  DataTable,
  EmptyState,
  StatusBadge,
  Surface,
  type BreadcrumbItemData,
  type DataTableColumn,
  type StatusTone,
} from '@advicelink/ui';

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

interface ClientRow {
  id: string;
  displayName: string;
  workflowState: string;
  workflowPhase: string;
  updatedAt: Date | string;
}

function ClientsIndexPage(): ReactElement {
  const { tenantSlug } = Route.useParams();
  const list = trpc.clients.list.useQuery({ limit: 100 });

  const breadcrumbs: BreadcrumbItemData[] = [{ id: 'clients', label: 'Clients' }];

  const columns: ReadonlyArray<DataTableColumn<ClientRow>> = [
    {
      id: 'name',
      header: 'Name',
      emphasis: 'strong',
      cell: (row) => row.displayName || '(unnamed)',
    },
    {
      id: 'workflowState',
      header: 'Workflow stage',
      cell: (row) => (
        <StatusBadge tone={toneForWorkflowState(row.workflowState)}>
          {humaniseState(row.workflowState)}
        </StatusBadge>
      ),
    },
    {
      id: 'phase',
      header: 'Phase',
      cell: (row) => (
        <StatusBadge tone={toneForWorkflowPhase(row.workflowPhase)}>
          {humanisePhase(row.workflowPhase)}
        </StatusBadge>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Last updated',
      emphasis: 'muted',
      cell: (row) => formatDate(row.updatedAt),
    },
    {
      id: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'end',
      cell: (row) => (
        <Button asChild tone="ghost" size="sm">
          <Link
            to="/t/$tenantSlug/clients/$clientId/fact-find"
            params={{ tenantSlug, clientId: row.id }}
            search={{ section: 'personal' }}
          >
            Open
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <AppShell tenantSlug={tenantSlug} breadcrumbs={breadcrumbs}>
      <Surface
        title="Clients"
        description="Every client your tenant can see — RLS filters automatically."
        actions={
          <Button asChild iconStart={Plus}>
            <Link to="/t/$tenantSlug/clients/new" params={{ tenantSlug }}>
              New client
            </Link>
          </Button>
        }
        padded={false}
      >
        {list.isPending ? (
          <EmptyState icon={Loader2} title="Loading clients…" />
        ) : list.isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load clients"
            description={list.error.message}
          />
        ) : (
          <DataTable<ClientRow>
            columns={columns}
            rows={list.data}
            keyAccessor={(row) => row.id}
            empty={
              <EmptyState
                icon={Users}
                title="No clients yet"
                description="Create your first client to start a Fact Find."
                action={
                  <Button asChild iconStart={Plus}>
                    <Link to="/t/$tenantSlug/clients/new" params={{ tenantSlug }}>
                      New client
                    </Link>
                  </Button>
                }
              />
            }
          />
        )}
      </Surface>
    </AppShell>
  );
}

/**
 * Display labels + status tones for workflow states / phases.
 * Stringly-typed comparisons would violate the workflow-machine rule;
 * the labels here are pure presentation and never compared back, so a
 * plain lookup is fine.
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

const STATE_TONES: Record<string, StatusTone> = {
  factFinding: 'progress',
  draftingSOA: 'progress',
  reviewingSOA: 'progress',
  amendingSOA: 'warning',
  presentingSOA: 'progress',
  welcomeCallScheduled: 'info',
  draftingROAEO: 'progress',
  reviewingROAEO: 'progress',
  implementingAdvice: 'info',
  insuranceAmendment: 'warning',
  waitingForAR: 'neutral',
  dueForAR: 'warning',
  arBooked: 'info',
  draftingAR: 'progress',
  reviewingAR: 'progress',
  arComplete: 'success',
  lost: 'danger',
};

const PHASE_TONES: Record<string, StatusTone> = {
  factFind: 'neutral',
  soaProduction: 'progress',
  presentation: 'info',
  postAdvice: 'info',
  complete: 'success',
  waiting: 'neutral',
  annualReview: 'info',
  closed: 'neutral',
};

function humaniseState(state: string): string {
  return STATE_LABELS[state] ?? state;
}

function humanisePhase(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

function toneForWorkflowState(state: string): StatusTone {
  return STATE_TONES[state] ?? 'neutral';
}

function toneForWorkflowPhase(phase: string): StatusTone {
  return PHASE_TONES[phase] ?? 'neutral';
}

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}
