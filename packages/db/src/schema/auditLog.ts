import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `audit_log` is the per-tenant append-only event stream. REBUILD_PLAN §12.5
 * mandates a `BEFORE DELETE` trigger that rejects every deletion attempt;
 * that trigger is installed in `0003_rls_policies.sql`.
 *
 * `client_id` is intentionally not a foreign key (the `clients` table doesn't
 * exist until WP-7); we add it as a plain UUID column now and back-fill the
 * FK constraint when the clients table lands. `actor_id` is nullable so
 * system-generated events (Firebase login mirrors, cron auto-releases) can
 * be recorded without a user attribution.
 *
 * `type` is text rather than an enum because the canonical event taxonomy
 * lives in `@advicelink/analytics` and grows per work package — keeping it
 * as text avoids a migration every time we add an event.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCreatedIdx: index('audit_log_tenant_created_idx').on(
      table.tenantId,
      table.createdAt.desc(),
    ),
    clientIdx: index('audit_log_client_id_idx').on(table.clientId),
    typeIdx: index('audit_log_type_idx').on(table.type),
  }),
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
