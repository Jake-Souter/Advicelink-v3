import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `admin_audit_log` is the cross-tenant counterpart to `audit_log` —
 * REBUILD_PLAN §10 / §12.5. Every write performed via an `/admin/*`
 * surface lands here regardless of which tenant it affected.
 *
 * - `affected_tenant_id` is nullable so platform-wide actions (creating a
 *   new tenant, rotating the platform-level Anthropic key, etc.) can be
 *   recorded.
 * - Append-only: same `BEFORE DELETE` trigger as `audit_log`.
 * - RLS: `platform_super_admin` sees everything; `tenant_super_admin`
 *   sees only rows where `affected_tenant_id` matches their tenant.
 */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    affectedTenantId: uuid('affected_tenant_id').references(() => tenants.id, {
      onDelete: 'set null',
    }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    affectedTenantIdx: index('admin_audit_log_affected_tenant_idx').on(table.affectedTenantId),
    actorIdx: index('admin_audit_log_actor_idx').on(table.actorId),
    createdIdx: index('admin_audit_log_created_idx').on(table.createdAt.desc()),
  }),
);

export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogEntry = typeof adminAuditLog.$inferInsert;
