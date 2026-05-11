-- WP-6.4 — SECURITY DEFINER lookup for the lead-gen create-client form.
--
-- A lead-gen tenant cannot SELECT from `tenants` for foreign rows
-- (the `tenants` RLS policy hides every tenant row except the actor's
-- own + platform-super-admins). The create-client form needs a list
-- of destination advice firms with active grants — the destination
-- dropdown — so this function returns exactly that set, with owner
-- privileges, scoped to a single lead-gen tenant id supplied by the
-- caller.
--
-- The caller is responsible for passing its own tenant id (the API
-- layer reads this from `app.current_tenant_id` and forbids any
-- mismatch — see `tenants.listGrantedAdviceFirms`).

SET ROLE postgres;

CREATE OR REPLACE FUNCTION app_list_granted_advice_firms(
  p_lead_gen_tenant_id uuid
) RETURNS TABLE(id uuid, slug text, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, t.slug, t.display_name
    FROM lead_gen_grants g
    JOIN tenants t ON t.id = g.advice_tenant_id
   WHERE g.lead_gen_tenant_id = p_lead_gen_tenant_id
     AND g.revoked_at IS NULL
     AND t.status = 'active'
   ORDER BY t.display_name ASC;
$$;

GRANT EXECUTE ON FUNCTION app_list_granted_advice_firms(uuid) TO app_user;

RESET ROLE;
