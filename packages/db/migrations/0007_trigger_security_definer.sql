-- 0007_trigger_security_definer.sql
-- WP-6.1 follow-up. The cross-tenant tenant-kind sanity triggers
-- introduced in 0005 (lead_gen_grants) and 0006 (clients) need to
-- read `tenants` rows belonging to other tenants:
--
--  * On `clients` INSERT, a lead-gen user fires the trigger from
--    inside their own tenant context. The trigger then has to look up
--    `tenants.kind` for the *destination advice tenant* — which RLS
--    correctly hides from the lead-gen user.
--  * On `lead_gen_grants` INSERT, the advice tenant_super_admin fires
--    the trigger and similarly needs to look up the *lead-gen
--    tenant's* kind.
--
-- These functions exist solely to assert structural invariants on
-- references the row already declared. Marking them SECURITY DEFINER
-- runs them as the function owner (`postgres`, the cluster
-- superuser), which bypasses RLS for the lookup but does not leak
-- anything back to the caller — only RAISE EXCEPTION on a bad row,
-- otherwise RETURN NEW unchanged.
--
-- The RLS policies on `clients` and `lead_gen_grants` themselves are
-- unchanged; only the validator functions get the elevated
-- privilege.

ALTER FUNCTION app_clients_check_tenant_kinds() SECURITY DEFINER;
ALTER FUNCTION app_check_lead_gen_grant_tenant_kinds() SECURITY DEFINER;
