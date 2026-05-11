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

/**
 * Tenant kind discriminates the two B2B-SaaS shapes Advicelink v3
 * supports (REBUILD_PLAN §2.6, added in WP-5.5):
 *
 *  - `'advice'` — a financial advice firm (the legacy default; owns
 *    advisers, paraplanners, AR support, etc., and is the destination
 *    of every signed onboarding pack).
 *  - `'lead_gen'` — an external lead-generation agency that captures
 *    leads on behalf of one or more advice firms. Owns lead-gen users
 *    only; cross-tenant access to the destination advice firm is
 *    granted by `lead_gen_grants` rows.
 */
export const tenantKind = pgEnum('tenant_kind', ['advice', 'lead_gen']);

export const calendarProvider = pgEnum('calendar_provider', ['microsoft', 'google']);

export type UserRole = (typeof userRole.enumValues)[number];
export type TeamType = (typeof teamType.enumValues)[number];
export type MembershipSeat = (typeof membershipSeat.enumValues)[number];
export type TenantStatus = (typeof tenantStatus.enumValues)[number];
export type TenantKind = (typeof tenantKind.enumValues)[number];
export type CalendarProvider = (typeof calendarProvider.enumValues)[number];
