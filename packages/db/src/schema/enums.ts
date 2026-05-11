import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Postgres enums backing every typed text column on the v3 base tables.
 * These map 1:1 with `migrations/0001_base_tables.sql` `CREATE TYPE` statements.
 *
 * REBUILD_PLAN refs:
 * - User roles: §4.1
 * - Team families and types: §4.2 / §7.3
 * - Membership seats: §7.4
 * - Tenant statuses: §7.1
 */

export const userRole = pgEnum('user_role', [
  'platform_super_admin',
  'tenant_super_admin',
  'lead_gen',
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management',
  'legacy_import',
]);

export const teamType = pgEnum('team_type', ['marketing', 'advisory', 'paraplanner_pool']);

export const membershipSeat = pgEnum('membership_seat', [
  'lead_gen',
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management',
]);

export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended']);

export const calendarProvider = pgEnum('calendar_provider', ['microsoft', 'google']);

export type UserRole = (typeof userRole.enumValues)[number];
export type TeamType = (typeof teamType.enumValues)[number];
export type MembershipSeat = (typeof membershipSeat.enumValues)[number];
export type TenantStatus = (typeof tenantStatus.enumValues)[number];
export type CalendarProvider = (typeof calendarProvider.enumValues)[number];
