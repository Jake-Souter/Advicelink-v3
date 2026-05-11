-- 0003_rls_policies.sql
-- Row-Level Security: the *third* layer of authorisation defence per
-- REBUILD_PLAN §12.2. Even if a future bug at the service layer omits
-- a tenant filter, RLS guarantees no cross-tenant data leak.
--
-- Pattern:
--   1. Two stable SQL helpers read the per-transaction GUCs
--      `app.current_tenant_id` and `app.current_user_role`.
--   2. Every tenant-scoped table enables RLS with FORCE so even the table
--      owner is subject to policies.
--   3. The standard policy form is "tenant_id = app_current_tenant_id()
--      OR role = 'platform_super_admin'". Without the GUC, the function
--      returns NULL and the comparison fails — a request without
--      authentication context cannot read or write anything.
--
-- These GUCs are set by `withTenantContext()` / `withPlatformAdmin()` in
-- packages/db/src/client.ts. Inserts via tools that bypass that helper
-- (psql, ad-hoc scripts) MUST issue `SELECT set_config(...)` themselves.

----------------------------------------------------------------------
-- GUC reader helpers
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid AS $$
  -- `true` means "missing GUC is OK, return ''"; NULLIF turns '' into NULL
  -- so a NULL ::uuid cast is the failure mode rather than an exception.
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '');
$$ LANGUAGE sql STABLE;

----------------------------------------------------------------------
-- tenants: only the platform_super_admin can mutate; tenant_super_admin
-- and below can SELECT their own row.
----------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON tenants FOR SELECT
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR id = app_current_tenant_id()
  );

CREATE POLICY tenants_insert ON tenants FOR INSERT
  WITH CHECK (app_current_user_role() = 'platform_super_admin');

CREATE POLICY tenants_update ON tenants FOR UPDATE
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR (app_current_user_role() = 'tenant_super_admin' AND id = app_current_tenant_id())
  )
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR (app_current_user_role() = 'tenant_super_admin' AND id = app_current_tenant_id())
  );

CREATE POLICY tenants_delete ON tenants FOR DELETE
  USING (app_current_user_role() = 'platform_super_admin');

----------------------------------------------------------------------
-- users / teams / team_memberships: standard tenant-scoped policy
----------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE  ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON users FOR ALL
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  )
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE  ROW LEVEL SECURITY;

CREATE POLICY teams_tenant_isolation ON teams FOR ALL
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  )
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );

ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships FORCE  ROW LEVEL SECURITY;

CREATE POLICY team_memberships_tenant_isolation ON team_memberships FOR ALL
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  )
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );

----------------------------------------------------------------------
-- audit_log: same isolation as the rest of the tenant tables. INSERTs
-- always permitted from inside a valid tenant context (so any feature
-- service can append). UPDATEs are not permitted at all (append-only);
-- DELETEs are blocked by trigger AND lacking a policy.
----------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );

CREATE POLICY audit_log_insert ON audit_log FOR INSERT
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );
-- (no UPDATE / DELETE policy => denied by FORCE RLS in addition to the
-- BEFORE DELETE trigger from 0002_triggers.sql)

----------------------------------------------------------------------
-- admin_audit_log: cross-tenant, but tenant_super_admin sees only the
-- rows that affect their own tenant.
----------------------------------------------------------------------
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_select ON admin_audit_log FOR SELECT
  USING (
    app_current_user_role() = 'platform_super_admin'
    OR (
      app_current_user_role() = 'tenant_super_admin'
      AND affected_tenant_id = app_current_tenant_id()
    )
  );

CREATE POLICY admin_audit_log_insert ON admin_audit_log FOR INSERT
  WITH CHECK (
    app_current_user_role() IN ('platform_super_admin', 'tenant_super_admin')
  );
