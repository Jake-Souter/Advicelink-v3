-- 0002_triggers.sql
-- Generic trigger functions + their attachments. Kept separate from
-- 0003_rls_policies.sql so the audit-log delete prevention reads naturally
-- next to the other immutable-row triggers.

----------------------------------------------------------------------
-- updated_at: set NEW.updated_at := now() on every UPDATE
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();

CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();

----------------------------------------------------------------------
-- audit append-only: REBUILD_PLAN §12.5 mandates that audit_log and
-- admin_audit_log rows can never be deleted in-band. Use this trigger
-- (not just RLS) because RLS policies can be bypassed by a future
-- BYPASSRLS role; a trigger fires unconditionally.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_block_audit_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Refusing to DELETE from %: rows are append-only (REBUILD_PLAN §12.5)',
    TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION app_block_audit_delete();

CREATE TRIGGER admin_audit_log_no_delete BEFORE DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION app_block_audit_delete();

----------------------------------------------------------------------
-- team_memberships.tenant_id sanity: must equal both teams.tenant_id
-- and users.tenant_id. Cheaper than a multi-FK constraint and keeps
-- the denormalised tenant_id (used by RLS) honest.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_check_team_membership_tenant() RETURNS trigger AS $$
DECLARE
  team_tenant uuid;
  user_tenant uuid;
BEGIN
  SELECT tenant_id INTO team_tenant FROM teams WHERE id = NEW.team_id;
  SELECT tenant_id INTO user_tenant FROM users WHERE id = NEW.user_id;
  IF team_tenant IS NULL OR user_tenant IS NULL THEN
    RAISE EXCEPTION 'team_memberships.team_id or user_id refers to a missing row';
  END IF;
  IF team_tenant <> NEW.tenant_id OR user_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION
      'team_memberships.tenant_id (%) must match teams.tenant_id (%) and users.tenant_id (%)',
      NEW.tenant_id, team_tenant, user_tenant;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_memberships_check_tenant
  BEFORE INSERT OR UPDATE ON team_memberships
  FOR EACH ROW EXECUTE FUNCTION app_check_team_membership_tenant();
