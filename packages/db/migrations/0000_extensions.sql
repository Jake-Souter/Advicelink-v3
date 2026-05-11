-- 0000_extensions.sql
-- Postgres extensions used across v3.
--
-- - pgcrypto:  gen_random_uuid() and pgp_sym_encrypt for tenant-scoped TFN
--              encryption (REBUILD_PLAN §19.16). Required before any table
--              that uses gen_random_uuid() as a default.
-- - citext:    case-insensitive text type used for users.email so 'Jane@x'
--              and 'jane@x' don't collide on the per-tenant unique index.
-- - pg_trgm:   trigram indexes for client-search across personal.firstName
--              / surname (used from WP-7 onward; cheap to enable now).
-- - btree_gin: composite GIN indexes over jsonb + scalar columns (planned
--              for clients.workflow_state filters in WP-7); also cheap.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
