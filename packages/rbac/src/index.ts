/**
 * Role-based access helpers — the canonical role catalogue plus simple
 * predicates used by the API layer (tRPC role allow-list middleware) and
 * by feature services (`assertCanAccessClient`, etc., added per work
 * package). REBUILD_PLAN §4.1, §4.2, §4.4.
 *
 * Visibility rules (`canAccessPage`, the §4.3 matrix) and the
 * `assertCanAccessClient` helper land in WP-7 once the `clients` table
 * exists. The role catalogue and family-membership helpers below are
 * everything WP-3 needs.
 */

export const ROLES = [
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
] as const satisfies readonly string[];

export type Role = (typeof ROLES)[number];

/** Type guard: is `value` a known role string? */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** REBUILD_PLAN §4.2 — Marketing family roles (lead-gen only at v1). */
export const MARKETING_ROLES = ['lead_gen'] as const satisfies readonly Role[];

/** REBUILD_PLAN §4.2 — Advice family roles (everyone post-handoff). */
export const ADVICE_ROLES = [
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management',
] as const satisfies readonly Role[];

/** Tenant-wide roles that don't sit in either advice/marketing family. */
export const TENANT_WIDE_ROLES = [
  'tenant_super_admin',
  'legacy_import',
] as const satisfies readonly Role[];

/** Roles managed entirely by Advicelink staff. */
export const PLATFORM_ROLES = ['platform_super_admin'] as const satisfies readonly Role[];

export function isMarketingRole(role: Role): boolean {
  return (MARKETING_ROLES as readonly Role[]).includes(role);
}

export function isAdviceRole(role: Role): boolean {
  return (ADVICE_ROLES as readonly Role[]).includes(role);
}

export function isPlatformRole(role: Role): boolean {
  return (PLATFORM_ROLES as readonly Role[]).includes(role);
}

/**
 * `platform_super_admin` ⊃ `tenant_super_admin` ⊃ everyone else. Used by
 * tRPC `.withRoles()` middleware so an `[adviser]` allow-list also lets
 * platform/tenant super-admins through (they're omnipotent escape
 * hatches; REBUILD_PLAN §4.1).
 */
export function isAtLeastTenantAdmin(role: Role): boolean {
  return role === 'platform_super_admin' || role === 'tenant_super_admin';
}

/**
 * Build the effective allow-list a `withRoles()` middleware should
 * enforce: the explicit roles plus the always-allowed tenant + platform
 * super-admins. Returns a Set for O(1) membership checks.
 */
export function expandAllowList(allow: readonly Role[]): ReadonlySet<Role> {
  return new Set<Role>([...allow, 'tenant_super_admin', 'platform_super_admin']);
}
