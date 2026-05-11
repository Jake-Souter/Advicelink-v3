import { sql } from 'drizzle-orm';
import {
  customType,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { calendarProvider, userRole } from './enums.js';
import { tenants } from './tenants.js';

/**
 * `citext` is a Postgres extension type (case-insensitive text). We model it
 * here as a custom type so Drizzle generates the right SQL for tooling and
 * keeps inferred columns typed as `string`. The actual `CREATE EXTENSION
 * citext` lives in `migrations/0000_extensions.sql`.
 */
const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
});

/**
 * `users` are tenant-bound. `firebase_uid` is the Firebase Auth subject
 * claim and is the only identifier the API trusts cross-request. `email`
 * is `citext`, unique within a tenant (the same address can legally exist
 * at two tenants).
 *
 * `default_team_id` references `teams.id` but the FK is added in a later
 * migration step (after `teams` exists) to break the circular dependency.
 *
 * Per REBUILD_PLAN §7.2.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    firebaseUid: text('firebase_uid').notNull().unique(),
    email: citext('email').notNull(),
    displayName: text('display_name').notNull(),
    role: userRole('role').notNull(),
    defaultTeamId: uuid('default_team_id'),
    calendarProvider: calendarProvider('calendar_provider'),
    calendarSubId: text('calendar_sub_id'),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    emailPerTenantIdx: uniqueIndex('users_email_per_tenant_idx').on(table.tenantId, table.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
