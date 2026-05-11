-- 0004_app_role.sql
-- The connecting database role on Railway is `postgres`, which is the
-- cluster superuser. Postgres superusers BYPASS row-level security
-- unconditionally — even `FORCE ROW LEVEL SECURITY` does not apply to
-- them. That makes RLS effectively decorative if the application talks
-- to Postgres as the connecting role.
--
-- We solve this with the standard pattern: create a non-superuser
-- `app_user` role, grant it the minimum table privileges it needs, and
-- have `withTenantContext` / `withPlatformAdmin` issue
-- `SET LOCAL ROLE app_user` immediately after BEGIN. The transaction
-- then runs under a non-superuser principal and RLS engages.
--
-- DDL (migrations) intentionally keeps running as the connecting
-- superuser — `migrate.ts` does NOT call SET ROLE because creating
-- tables, types, and functions needs ownership privileges.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

-- Schema access
GRANT USAGE ON SCHEMA public TO app_user;

-- Table access on every existing table (the migration runs after 0001)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app_user;
GRANT USAGE                                ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE                              ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- And every future table that `postgres` creates (i.e. via later migrations)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_user;

-- The connecting role must be GRANTed app_user before it can SET ROLE
-- into it. On Railway the connecting role is `postgres`; in the rls.test
-- the same connection runs both setup (as superuser) and assertions
-- (as app_user via SET LOCAL ROLE) which is exactly the production
-- pattern.
GRANT app_user TO postgres;
