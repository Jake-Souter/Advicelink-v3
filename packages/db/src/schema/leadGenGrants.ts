import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `lead_gen_grants` mediates cross-tenant access between a lead-gen
 * agency tenant (`kind = 'lead_gen'`) and a destination advice firm
 * (`kind = 'advice'`). REBUILD_PLAN §2.6 (added in WP-5.5).
 *
 * Semantics:
 *  - A row asserts: "users in `lead_gen_tenant_id` may create new
 *    clients whose `destination_advice_tenant_id = advice_tenant_id`,
 *    and may read those clients' rows according to the dual-tenant RLS
 *    policy on `clients`."
 *  - Issued by a `tenant_super_admin` of the **advice** firm via the
 *    "Lead-gen partners" admin page (lands in a later WP).
 *  - Soft-revoked by setting `revoked_at` — we keep the row so audit
 *    history of "which agency referred this client" remains queryable.
 *
 * RLS for this table itself: only the two named partner tenants and
 * platform super-admins may read. Writes are restricted to
 * `tenant_super_admin` of the advice tenant (or platform super-admin).
 * Policies live in `migrations/0005_lead_gen_grants.sql`.
 */
/**
 * Note: the partial unique index `(lead_gen_tenant_id,
 * advice_tenant_id) WHERE revoked_at IS NULL` lives in the SQL
 * migration (`migrations/0005_lead_gen_grants.sql`) — Drizzle's
 * uniqueIndex doesn't model the `WHERE` clause, but the constraint
 * is essential so the same pair can be re-granted after revocation.
 */
export const leadGenGrants = pgTable('lead_gen_grants', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  leadGenTenantId: uuid('lead_gen_tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  adviceTenantId: uuid('advice_tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  grantedByUserId: uuid('granted_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export type LeadGenGrant = typeof leadGenGrants.$inferSelect;
export type NewLeadGenGrant = typeof leadGenGrants.$inferInsert;
