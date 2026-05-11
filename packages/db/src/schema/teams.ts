import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { teamType } from './enums.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `teams` belong to one of two non-overlapping families: `marketing`
 * (lead-gen only) and `advisory` (everyone else). `paraplanner_pool` is a
 * special advisory-family team that paraplanners can be drawn from across
 * advisory teams — see REBUILD_PLAN §4.2 / §10.6.
 *
 * `licensee` is the AFSL holder JSON (ABN, name, address, logos) used by
 * docxtemplater renders. `config` carries page-visibility overrides,
 * AR cadence offsets, and per-team SOA-Wizard section overrides.
 */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    type: teamType('type').notNull(),
    brandOverrides: jsonb('brand_overrides'),
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
    licensee: jsonb('licensee')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => ({
    namePerTenantIdx: uniqueIndex('teams_name_per_tenant_idx').on(table.tenantId, table.name),
  }),
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
