import { describe, expect, it } from 'vitest';

import {
  ADVICE_ROLES,
  MARKETING_ROLES,
  ROLES,
  expandAllowList,
  isAdviceRole,
  isAtLeastTenantAdmin,
  isMarketingRole,
  isPlatformRole,
  isRole,
  type Role,
} from '../src/index.js';

describe('@advicelink/rbac', () => {
  it('lists every role from REBUILD_PLAN §4.1 (10 total)', () => {
    expect(ROLES).toHaveLength(10);
    expect(new Set(ROLES).size).toBe(10);
  });

  it('isRole accepts known and rejects unknown values', () => {
    expect(isRole('adviser')).toBe(true);
    expect(isRole('platform_super_admin')).toBe(true);
    expect(isRole('typo_role')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  it('family membership: marketing, advice, platform partitions are disjoint', () => {
    for (const role of MARKETING_ROLES) {
      expect(isMarketingRole(role)).toBe(true);
      expect(isAdviceRole(role)).toBe(false);
      expect(isPlatformRole(role)).toBe(false);
    }
    for (const role of ADVICE_ROLES) {
      expect(isAdviceRole(role)).toBe(true);
      expect(isMarketingRole(role)).toBe(false);
      expect(isPlatformRole(role)).toBe(false);
    }
    expect(isPlatformRole('platform_super_admin')).toBe(true);
  });

  it('expandAllowList always permits both super-admin tiers', () => {
    const set = expandAllowList(['adviser']);
    expect(set.has('adviser')).toBe(true);
    expect(set.has('tenant_super_admin')).toBe(true);
    expect(set.has('platform_super_admin')).toBe(true);
    expect(set.has('lead_gen')).toBe(false);
  });

  it('expandAllowList with an empty list still permits super-admins', () => {
    const set = expandAllowList([]);
    expect(set.size).toBe(2);
    expect(set.has('platform_super_admin')).toBe(true);
    expect(set.has('tenant_super_admin')).toBe(true);
  });

  it('isAtLeastTenantAdmin captures the §4.1 escape-hatch tier', () => {
    expect(isAtLeastTenantAdmin('platform_super_admin')).toBe(true);
    expect(isAtLeastTenantAdmin('tenant_super_admin')).toBe(true);
    expect(isAtLeastTenantAdmin('adviser')).toBe(false);
    expect(isAtLeastTenantAdmin('management')).toBe(false);
  });

  it('every role flows through one and only one family check', () => {
    for (const role of ROLES as readonly Role[]) {
      const families = [
        isMarketingRole(role),
        isAdviceRole(role),
        isPlatformRole(role),
        // tenant-wide roles (tenant_super_admin, legacy_import) sit outside the
        // three families — so the count is allowed to be 0 for those.
      ].filter(Boolean).length;
      expect(families).toBeLessThanOrEqual(1);
    }
  });
});
