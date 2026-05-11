import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenantStatus } from './enums.js';

/**
 * `tenants` is the root of the multi-tenant graph. It is the only table
 * whose RLS does *not* depend on `app.current_tenant_id` — instead we
 * gate by `app.current_user_role`. See REBUILD_PLAN §2 / §7.1.
 *
 * `brand_bundle` is a freeform JSONB blob whose shape is owned by
 * `@advicelink/branding`; `feature_flags` is `{ [key: string]: boolean }`.
 *
 * `enc_key_version` participates in the per-tenant `pgcrypto` rotation
 * scheme described in §19.16. Defaults to 1 for new tenants; bumped by a
 * cron worker during dual-write windows.
 */
export const tenants = pgTable('tenants', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  primaryDomain: text('primary_domain'),
  status: tenantStatus('status').notNull().default('active'),
  brandBundle: jsonb('brand_bundle')
    .notNull()
    .default(sql`'{}'::jsonb`),
  featureFlags: jsonb('feature_flags')
    .notNull()
    .default(sql`'{}'::jsonb`),
  encKeyVersion: integer('enc_key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
