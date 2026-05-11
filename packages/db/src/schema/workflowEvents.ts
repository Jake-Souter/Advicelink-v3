import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { clients } from './clients.js';
import { tenants } from './tenants.js';
import { transitionTrigger, workflowState } from './enums.js';
import { users } from './users.js';

/**
 * Append-only audit trail for every workflow transition the
 * `clientWorkflowMachine` accepts.
 *
 * The service layer writes one row per transition immediately AFTER
 * `canTransition(...).ok` and BEFORE the `clients.workflow_state`
 * update — both run inside the same transaction so a failure rolls
 * back together. Per REBUILD_PLAN §5.3 / §19.6.
 *
 * Storage is intentionally fat (we keep payload + actor + tenant
 * context per row) because workflow_events doubles as the source for:
 *   - the per-client "Activity" tab (§6.4.1)
 *   - admin compliance reports (§6.27)
 *   - retro-active analytics (PostHog "track funnel" via DB rather
 *     than client-side events to avoid double-counting).
 *
 * `actor_tenant_id` is captured separately from the row's
 * `tenant_id` (which is always the active OWNER) so cross-tenant
 * lead-gen events still attribute correctly: an advice-tenant
 * paraplanner firing `sendSOAForReview` on a lead-gen-owned client
 * shows up with `tenant_id = lead-gen` and
 * `actor_tenant_id = advice`.
 *
 * Append-only is enforced by the `app_block_audit_delete` trigger
 * registered in 0002_triggers.sql and re-applied in 0006 against the
 * new table.
 */
export const workflowEvents = pgTable(
  'workflow_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Active owner tenant of the client at write time. */
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),

    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    /** From-state may be NULL for the synthetic 'create' event. */
    fromState: workflowState('from_state'),
    toState: workflowState('to_state').notNull(),

    /** WorkflowTransitionName from @advicelink/workflow. Stored as
     * text rather than an enum because the set evolves and renaming
     * a transition would otherwise require a destructive enum
     * migration (REBUILD_PLAN §5.3 paragraph 2). */
    transitionName: text('transition_name').notNull(),

    trigger: transitionTrigger('trigger').notNull(),

    /** NULL for system / cron / webhook transitions. */
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

    /** The tenant the actor belongs to. Differs from `tenantId` on
     *  cross-tenant lead-gen writes (advice paraplanner editing a
     *  lead-gen-owned client during SOA Production). */
    actorTenantId: uuid('actor_tenant_id').references(() => tenants.id, {
      onDelete: 'set null',
    }),

    /** Free-form compliance reason. Required by `requiresReason`
     *  transitions (currently only `markLost`); enforced in the
     *  service layer via `canTransition`. */
    reason: text('reason'),

    /** Arbitrary payload for the transition (e.g. webhook envelope id,
     *  auto-release threshold ms, etc.). Schema owned per-transition
     *  in @advicelink/schemas and validated before insert. */
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Per-client chronological scan (Activity tab). */
    byClientIdx: index('workflow_events_by_client_idx').on(table.clientId, table.createdAt),
    /** Per-tenant sweep for admin reports + analytics. */
    byTenantIdx: index('workflow_events_by_tenant_idx').on(table.tenantId, table.createdAt),
  }),
);

export type WorkflowEvent = typeof workflowEvents.$inferSelect;
export type NewWorkflowEvent = typeof workflowEvents.$inferInsert;
