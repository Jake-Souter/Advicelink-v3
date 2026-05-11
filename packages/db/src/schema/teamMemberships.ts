import { boolean, index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { membershipSeat } from './enums.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `team_memberships` is the join between users and teams plus the user's
 * **seat** in that team. A user can hold several seats (e.g. AR Adviser on
 * one team, Adviser on another) — REBUILD_PLAN §7.4.
 *
 * `tenant_id` is denormalised here (not in the plan listing) so the RLS
 * policy on this table can use the same `tenant_id = current GUC` pattern
 * as every other tenant-scoped table. A check trigger in
 * `0003_rls_policies.sql` guards that the denormalised value matches
 * `teams.tenant_id` and `users.tenant_id`.
 */
export const teamMemberships = pgTable(
  'team_memberships',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seat: membershipSeat('seat').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId, table.seat] }),
    userIdx: index('team_memberships_user_id_idx').on(table.userId),
    tenantIdx: index('team_memberships_tenant_id_idx').on(table.tenantId),
  }),
);

export type TeamMembership = typeof teamMemberships.$inferSelect;
export type NewTeamMembership = typeof teamMemberships.$inferInsert;
