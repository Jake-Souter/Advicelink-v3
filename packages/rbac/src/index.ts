/**
 * Role-based access helpers.
 *
 * Populated by Work Package 3 (Auth + tRPC skeleton): `assertCanAccessClient`,
 * `canAccessPage`, the page-access matrix from REBUILD_PLAN §4.3, and
 * visibility rules from §4.4.
 */

export type Role =
  | 'platform_super_admin'
  | 'tenant_super_admin'
  | 'lead_gen'
  | 'adviser'
  | 'paraplanner'
  | 'uf_support'
  | 'ar_support'
  | 'ar_adviser'
  | 'management'
  | 'legacy_import';
