-- WP-6.3 — SECURITY DEFINER helpers for lead-gen client creation.
--
-- The `clients.create` service validates two things before inserting a
-- client into the lead-gen tenant:
--
--   1. The destination advice tenant exists, is `kind = 'advice'`, and
--      is `status = 'active'`.
--   2. An unrevoked `lead_gen_grants` row links the lead-gen tenant to
--      that advice tenant.
--
-- Both lookups would be hidden by RLS from a lead-gen tenant context
-- (the destination tenant row is in a different RLS partition and the
-- lead-gen tenant cannot see foreign tenants on `tenants`). The
-- existing `clients_check_tenant_kinds` trigger covers (1) at row-
-- write time, but a friendly application-layer error is much better
-- than a Postgres trigger exception.
--
-- These two functions run with owner privileges (SECURITY DEFINER)
-- and a locked-down `search_path` so they bypass RLS for the read-
-- only checks the service needs, without exposing a generic escape
-- hatch.

SET ROLE postgres;

CREATE OR REPLACE FUNCTION app_lookup_tenant_for_grant(
  p_tenant_id uuid
) RETURNS TABLE(kind tenant_kind, status tenant_status)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.kind, t.status FROM tenants t WHERE t.id = p_tenant_id;
$$;

CREATE OR REPLACE FUNCTION app_has_active_lead_gen_grant(
  p_lead_gen_tenant_id uuid,
  p_advice_tenant_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lead_gen_grants g
    WHERE g.lead_gen_tenant_id = p_lead_gen_tenant_id
      AND g.advice_tenant_id   = p_advice_tenant_id
      AND g.revoked_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION app_lookup_tenant_for_grant(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION app_has_active_lead_gen_grant(uuid, uuid) TO app_user;

RESET ROLE;
