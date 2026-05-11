import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';

import { clients } from '@advicelink/db';
import type { Role } from '@advicelink/rbac';
import {
  ADVISER_ACTIVE_STATES,
  AR_PIPELINE_STATES,
  AR_WIZARD_IN_PROGRESS_STATES,
  PARAPLANNER_CLAIMABLE_STATES,
  PRE_AR_FLAG_STATES,
  STATE_TO_PHASE,
  type WorkflowPhase,
  type WorkflowState,
} from '@advicelink/workflow';

import type { TxDb } from '../../trpc/context.js';

/**
 * `listForPortal` — single source of truth for the role-specific
 * portal kanbans (REBUILD_PLAN §6.1–§6.6).
 *
 * Each portal is a fixed list of buckets; rows that match a bucket's
 * predicate are surfaced in that column. The buckets themselves are
 * declared as an in-file table rather than scattered through six
 * route files so the contract for "what does the paraplanner portal
 * show?" is reviewable in one place.
 *
 * Tenant scope is enforced authoritatively by RLS on `clients`. The
 * predicates here only narrow inside that scope (workflow state,
 * ownership pointers). The actor's role is used to:
 *
 *   - Reject calls to a portal the role isn't allowed to see
 *     (defence-in-depth — the route also gates via `withRoles`).
 *   - Select the right ownership filter (e.g. paraplanner sees their
 *     own claims; adviser sees their own assigned clients + the
 *     pool in their team).
 */

export type PortalKey =
  | 'lead-gen'
  | 'adviser'
  | 'paraplanner'
  | 'uf-support'
  | 'ar-support'
  | 'ar-adviser';

export interface PortalBucket {
  key: string;
  label: string;
  description: string;
  clients: PortalClientRow[];
}

export interface PortalClientRow {
  id: string;
  displayName: string;
  workflowState: WorkflowState;
  workflowPhase: WorkflowPhase;
  factFindLockedAt: Date | null;
  claimedParaplannerId: string | null;
  claimedAt: Date | null;
  assignedAdviserId: string | null;
  assignedArAdviserId: string | null;
  advisoryTeamId: string | null;
  leadGenTeamId: string | null;
  nextArDate: string | null;
  updatedAt: Date;
}

interface ActorContext {
  id: string;
  role: Role;
  tenantId: string;
}

const PORTAL_ROLES: Record<PortalKey, readonly Role[]> = {
  'lead-gen': ['lead_gen', 'tenant_super_admin', 'platform_super_admin'],
  adviser: [
    'adviser',
    'ar_support',
    'ar_adviser',
    'management',
    'tenant_super_admin',
    'platform_super_admin',
  ],
  paraplanner: ['paraplanner', 'tenant_super_admin', 'platform_super_admin'],
  'uf-support': ['uf_support', 'tenant_super_admin', 'platform_super_admin'],
  'ar-support': [
    'ar_support',
    'ar_adviser',
    'management',
    'tenant_super_admin',
    'platform_super_admin',
  ],
  'ar-adviser': ['ar_adviser', 'tenant_super_admin', 'platform_super_admin'],
};

export async function listForPortal(
  tx: TxDb,
  portal: PortalKey,
  actor: ActorContext,
): Promise<PortalBucket[]> {
  if (!PORTAL_ROLES[portal].includes(actor.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `role '${actor.role}' cannot view portal '${portal}'`,
    });
  }

  switch (portal) {
    case 'lead-gen':
      return loadLeadGenPortal(tx);
    case 'adviser':
      return loadAdviserPortal(tx, actor);
    case 'paraplanner':
      return loadParaplannerPortal(tx, actor);
    case 'uf-support':
      return loadUfSupportPortal(tx);
    case 'ar-support':
      return loadArSupportPortal(tx);
    case 'ar-adviser':
      return loadArAdviserPortal(tx, actor);
  }
}

/* ─────────────────────────────────────────────────────────────────
 * Per-portal loaders
 * Each builds N buckets in parallel queries and returns them in
 * canonical order. Heavy tip-of-iceberg client rows aren't loaded —
 * the kanban only needs id + display + state + a few ownership
 * fields.
 * ─────────────────────────────────────────────────────────────── */

const portalSelect = {
  id: clients.id,
  displayName: clients.displayName,
  workflowState: clients.workflowState,
  workflowPhase: clients.workflowPhase,
  factFindLockedAt: clients.factFindLockedAt,
  claimedParaplannerId: clients.claimedParaplannerId,
  claimedAt: clients.claimedAt,
  assignedAdviserId: clients.assignedAdviserId,
  assignedArAdviserId: clients.assignedArAdviserId,
  advisoryTeamId: clients.advisoryTeamId,
  leadGenTeamId: clients.leadGenTeamId,
  nextArDate: clients.nextArDate,
  updatedAt: clients.updatedAt,
} as const;

async function loadLeadGenPortal(tx: TxDb): Promise<PortalBucket[]> {
  // Lead-gen owns the row through `factFinding` → `presentingSOA`.
  // The kanban groups by where in that pre-handoff arc the row sits.
  const newLeads = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(eq(clients.workflowState, 'factFinding'), isNull(clients.factFindLockedAt)))
    .orderBy(desc(clients.updatedAt));

  const factFinding = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(eq(clients.workflowState, 'factFinding'), isNotNull(clients.factFindLockedAt)))
    .orderBy(desc(clients.updatedAt));

  const presenting = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.workflowState, 'presentingSOA'))
    .orderBy(desc(clients.updatedAt));

  return [
    {
      key: 'new-leads',
      label: 'New leads',
      description: 'Captured but Fact Find not yet locked.',
      clients: rowsAs(newLeads),
    },
    {
      key: 'fact-finding',
      label: 'Fact Find locked — drafting',
      description: 'Fact Find is locked; the SOA is being drafted by paraplanners.',
      clients: rowsAs(factFinding),
    },
    {
      key: 'presenting',
      label: 'Presenting SOA',
      description: 'Lead-gen presenting the SOA and chasing the client signature.',
      clients: rowsAs(presenting),
    },
  ];
}

async function loadAdviserPortal(tx: TxDb, actor: ActorContext): Promise<PortalBucket[]> {
  // Adviser sees: clients assigned to them OR on their advisory team
  // in advice-tenant-owned states. Tenant super-admins / management
  // see across the whole tenant (no `assignedAdviserId` filter).
  const isPrivileged =
    actor.role === 'tenant_super_admin' ||
    actor.role === 'platform_super_admin' ||
    actor.role === 'management';

  const myClientFilter = isPrivileged ? sql`true` : eq(clients.assignedAdviserId, actor.id);

  const myClients = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(myClientFilter, inArray(clients.workflowState as never, [...ADVISER_ACTIVE_STATES])))
    .orderBy(desc(clients.updatedAt));

  const awaitingReview = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.workflowState, 'reviewingSOA'))
    .orderBy(desc(clients.updatedAt));

  const arPipeline = await tx
    .select(portalSelect)
    .from(clients)
    .where(inArray(clients.workflowState as never, [...AR_PIPELINE_STATES]))
    .orderBy(desc(clients.updatedAt));

  const roaEoPipeline = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.workflowState, 'reviewingROAEO'))
    .orderBy(desc(clients.updatedAt));

  return [
    {
      key: 'my-clients',
      label: isPrivileged ? 'All active clients' : 'My clients',
      description: 'Active advice-tenant-owned clients.',
      clients: rowsAs(myClients),
    },
    {
      key: 'awaiting-review',
      label: 'Awaiting SOA review',
      description: 'Paraplanner has sent the SOA to you for review.',
      clients: rowsAs(awaitingReview),
    },
    {
      key: 'ar-pipeline',
      label: 'AR pipeline',
      description: 'Annual Reviews due, booked, or in review.',
      clients: rowsAs(arPipeline),
    },
    {
      key: 'roa-eo-pipeline',
      label: 'ROA / EO awaiting review',
      description: 'ROA / EO documents waiting for adviser sign-off.',
      clients: rowsAs(roaEoPipeline),
    },
  ];
}

async function loadParaplannerPortal(tx: TxDb, actor: ActorContext): Promise<PortalBucket[]> {
  // Available pool: clients in drafting/amending states that nobody
  // has claimed yet. Claimed: clients this paraplanner currently
  // owns. Visibility into the whole pool relies on RLS keeping the
  // tenant scope tight; the pool/team filter (REBUILD_PLAN §4.4 says
  // "team / pool") is left for §10.6 once paraplanner pool config
  // exists. For v1 the pool is the whole advice tenant.
  const available = await tx
    .select(portalSelect)
    .from(clients)
    .where(
      and(
        inArray(clients.workflowState as never, [...PARAPLANNER_CLAIMABLE_STATES]),
        isNull(clients.claimedParaplannerId),
      ),
    )
    .orderBy(desc(clients.updatedAt));

  const claimed = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.claimedParaplannerId, actor.id))
    .orderBy(desc(clients.claimedAt));

  return [
    {
      key: 'available',
      label: 'Available',
      description: 'Unclaimed SOAs in your pool. Click Claim to take ownership.',
      clients: rowsAs(available),
    },
    {
      key: 'claimed',
      label: 'Claimed by me',
      description: 'Your active SOA work. Auto-released after 48h of inactivity.',
      clients: rowsAs(claimed),
    },
  ];
}

async function loadUfSupportPortal(tx: TxDb): Promise<PortalBucket[]> {
  // Pre-advised work queue (REBUILD_PLAN §6.4).
  const factFindQa = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(eq(clients.workflowState, 'factFinding'), isNotNull(clients.factFindLockedAt)))
    .orderBy(desc(clients.updatedAt));

  const documentsOutstanding = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.workflowState, 'implementingAdvice'))
    .orderBy(desc(clients.updatedAt));

  return [
    {
      key: 'fact-find-qa',
      label: 'Fact Find QA',
      description: 'Locked Fact Finds awaiting QA before SOA drafting.',
      clients: rowsAs(factFindQa),
    },
    {
      key: 'documents-outstanding',
      label: 'Implementation documents outstanding',
      description: 'Implementation in flight; documents and confirmations pending.',
      clients: rowsAs(documentsOutstanding),
    },
  ];
}

async function loadArSupportPortal(tx: TxDb): Promise<PortalBucket[]> {
  // AR Support post-advised pipeline (REBUILD_PLAN §6.5). The
  // 30-day "AR imminent" / "AR overdue" window uses the
  // `next_ar_date` column.
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const implementing = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.workflowState, 'implementingAdvice'))
    .orderBy(desc(clients.updatedAt));

  const servicing = await tx
    .select(portalSelect)
    .from(clients)
    .where(eq(clients.workflowState, 'waitingForAR'))
    .orderBy(desc(clients.updatedAt));

  const arImminent = await tx
    .select(portalSelect)
    .from(clients)
    .where(
      and(
        inArray(clients.workflowState as never, [...PRE_AR_FLAG_STATES]),
        isNotNull(clients.nextArDate),
        lte(clients.nextArDate, in30Days),
      ),
    )
    .orderBy(clients.nextArDate);

  const arOverdue = await tx
    .select(portalSelect)
    .from(clients)
    .where(
      or(
        eq(clients.workflowState, 'dueForAR'),
        and(
          inArray(clients.workflowState as never, [...PRE_AR_FLAG_STATES]),
          isNotNull(clients.nextArDate),
          lte(clients.nextArDate, todayIso),
        ),
      ),
    )
    .orderBy(clients.nextArDate);

  return [
    {
      key: 'implementing',
      label: 'Implementation in progress',
      description: 'Active implementation pipeline.',
      clients: rowsAs(implementing),
    },
    {
      key: 'servicing',
      label: 'Servicing — waiting for AR',
      description: 'Confirmed clients parked between Annual Reviews.',
      clients: rowsAs(servicing),
    },
    {
      key: 'ar-imminent',
      label: 'AR imminent (next 30 days)',
      description: 'Annual Review falls due within the next month.',
      clients: rowsAs(arImminent),
    },
    {
      key: 'ar-overdue',
      label: 'AR due now / overdue',
      description: 'Annual Review is due today or earlier.',
      clients: rowsAs(arOverdue),
    },
  ];
}

async function loadArAdviserPortal(tx: TxDb, actor: ActorContext): Promise<PortalBucket[]> {
  // AR Adviser portal (REBUILD_PLAN §6.6).
  const isPrivileged = actor.role === 'tenant_super_admin' || actor.role === 'platform_super_admin';
  const myArFilter = isPrivileged ? sql`true` : eq(clients.assignedArAdviserId, actor.id);

  const arDueThisMonth = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(myArFilter, eq(clients.workflowState, 'dueForAR')))
    .orderBy(clients.nextArDate);

  const arWizardInProgress = await tx
    .select(portalSelect)
    .from(clients)
    .where(
      and(myArFilter, inArray(clients.workflowState as never, [...AR_WIZARD_IN_PROGRESS_STATES])),
    )
    .orderBy(desc(clients.updatedAt));

  // ROA / EO equals the postAdvice phase exactly, so a phase-level
  // filter on the denormalised column is the simplest expression.
  const roaEoInProgress = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(myArFilter, eq(clients.workflowPhase, 'postAdvice')))
    .orderBy(desc(clients.updatedAt));

  const recentlyComplete = await tx
    .select(portalSelect)
    .from(clients)
    .where(and(myArFilter, eq(clients.workflowState, 'arComplete')))
    .orderBy(desc(clients.updatedAt))
    .limit(20);

  return [
    {
      key: 'ar-due',
      label: 'AR due',
      description: 'Annual Reviews flagged due that you can pick up.',
      clients: rowsAs(arDueThisMonth),
    },
    {
      key: 'ar-wizard',
      label: 'AR Wizard in progress',
      description: 'Active AR Wizard runs.',
      clients: rowsAs(arWizardInProgress),
    },
    {
      key: 'roa-eo',
      label: 'ROA / EO Wizard in progress',
      description: 'In-flight changes to issued advice.',
      clients: rowsAs(roaEoInProgress),
    },
    {
      key: 'recently-complete',
      label: 'Recently completed',
      description: 'Last 20 ARs awaiting CSA signature webhook.',
      clients: rowsAs(recentlyComplete),
    },
  ];
}

/**
 * Drizzle infers a row shape from `portalSelect` whose enum columns
 * are typed as their underlying string union — but TypeScript treats
 * those unions as a wider `string` once they cross the helper
 * boundary. `PortalRawRow` mirrors the inferred row shape exactly
 * so we can carry it through `rowsAs` without re-asserting on every
 * field.
 */
interface PortalRawRow {
  id: string;
  displayName: string;
  workflowState: WorkflowState;
  workflowPhase: WorkflowPhase;
  factFindLockedAt: Date | null;
  claimedParaplannerId: string | null;
  claimedAt: Date | null;
  assignedAdviserId: string | null;
  assignedArAdviserId: string | null;
  advisoryTeamId: string | null;
  leadGenTeamId: string | null;
  nextArDate: string | null;
  updatedAt: Date;
}

/**
 * `PortalClientRow` is structurally identical to the raw row today
 * (the public type just lives in this file as `PortalRawRow`). The
 * indirection is kept so future enrichment — e.g. resolving an
 * adviser display name — has a single mapping point.
 */
function rowsAs(rows: readonly PortalRawRow[]): PortalClientRow[] {
  return rows.map((r) => ({ ...r }));
}

/** Re-export so call-sites have one import path. */
export { STATE_TO_PHASE };
