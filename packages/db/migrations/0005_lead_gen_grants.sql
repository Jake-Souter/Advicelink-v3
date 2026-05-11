-- 0005_lead_gen_grants.sql
-- WP-5.5: lead-gen tenancy. Adds the `tenants.kind` discriminator and
-- the `lead_gen_grants` cross-tenant-access table. Mirrors
-- `packages/db/src/schema/{enums,tenants,leadGenGrants}.ts`.
--
-- See REBUILD_PLAN §2.6 (lead-gen tenancy + dual-tenant RLS) for the
-- end-to-end flow. RLS for `clients` (which depends on these grants)
-- lands with the `clients` table itself in WP-7; this migration is
-- forward-compatible — the dual-tenant clauses on `clients` will
-- reference `lead_gen_grants` when that table is created.

----------------------------------------------------------------------
-- Tenant kind enum + column
----------------------------------------------------------------------
CREATE TYPE tenant_kind AS ENUM ('advice', 'lead_gen');

ALTER TABLE tenants
  ADD COLUMN kind tenant_kind NOT NULL DEFAULT 'advice';

-- Existing seeded tenants (Ready Advice etc.) keep the 'advice'
-- default; new lead-gen agency tenants set the kind explicitly via
-- the platform-super-admin onboarding flow.

----------------------------------------------------------------------
-- lead_gen_grants
----------------------------------------------------------------------
CREATE TABLE lead_gen_grants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_gen_tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  advice_tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  granted_by_user_id    uuid NOT NULL REFERENCES users(id)   ON DELETE RESTRICT,
  granted_at            timestamptz NOT NULL DEFAULT now(),
  revoked_at            timestamptz,
  -- The two tenants must be of the right kinds; checked here so a
  -- bad insert at the service layer fails loudly. The subquery is
  -- safe because `tenants.kind` is a stable enum.
  CONSTRAINT lead_gen_grants_kind_check CHECK (
    lead_gen_tenant_id <> advice_tenant_id
  )
);

-- One *active* grant per pair; revoked rows can coexist with a
-- re-issued active row so the audit trail of past partnerships
-- remains queryable.
CREATE UNIQUE INDEX lead_gen_grants_active_pair_idx
  ON lead_gen_grants (lead_gen_tenant_id, advice_tenant_id)
  WHERE revoked_at IS NULL;

CREATE INDEX lead_gen_grants_lead_gen_idx
  ON lead_gen_grants (lead_gen_tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX lead_gen_grants_advice_idx
  ON lead_gen_grants (advice_tenant_id) WHERE revoked_at IS NULL;

----------------------------------------------------------------------
-- Function: kind-validation trigger. Belt-and-braces — ensures the
-- referenced tenants are of the kinds the grant claims they are.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_check_lead_gen_grant_tenant_kinds() RETURNS trigger AS $$
DECLARE
  lg_kind tenant_kind;
  ad_kind tenant_kind;
BEGIN
  SELECT kind INTO lg_kind FROM tenants WHERE id = NEW.lead_gen_tenant_id;
  SELECT kind INTO ad_kind FROM tenants WHERE id = NEW.advice_tenant_id;
  IF lg_kind IS DISTINCT FROM 'lead_gen' THEN
    RAISE EXCEPTION 'lead_gen_tenant_id (%) must reference a tenant with kind = lead_gen (got %)',
      NEW.lead_gen_tenant_id, lg_kind;
  END IF;
  IF ad_kind IS DISTINCT FROM 'advice' THEN
    RAISE EXCEPTION 'advice_tenant_id (%) must reference a tenant with kind = advice (got %)',
      NEW.advice_tenant_id, ad_kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_gen_grants_kind_trigger
  BEFORE INSERT OR UPDATE ON lead_gen_grants
  FOR EACH ROW EXECUTE FUNCTION app_check_lead_gen_grant_tenant_kinds();

----------------------------------------------------------------------
-- RLS on lead_gen_grants. Read: either named partner tenant + platform
-- super-admin. Write: only the advice tenant's super-admin (or
-- platform super-admin) — the agency cannot self-grant.
----------------------------------------------------------------------
ALTER TABLE lead_gen_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_gen_grants FORCE ROW LEVEL SECURITY;

CREATE POLICY lead_gen_grants_read ON lead_gen_grants
  FOR SELECT USING (
    app_current_user_role() = 'platform_super_admin'
    OR app_current_tenant_id() IN (lead_gen_tenant_id, advice_tenant_id)
  );

CREATE POLICY lead_gen_grants_write ON lead_gen_grants
  FOR ALL USING (
    app_current_user_role() = 'platform_super_admin'
    OR (
      app_current_tenant_id() = advice_tenant_id
      AND app_current_user_role() IN ('tenant_super_admin', 'platform_super_admin')
    )
  )
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR (
      app_current_tenant_id() = advice_tenant_id
      AND app_current_user_role() IN ('tenant_super_admin', 'platform_super_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON lead_gen_grants TO app_user;
