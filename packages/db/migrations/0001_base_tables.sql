-- 0001_base_tables.sql
-- WP-2 base tables: tenants, users, teams, team_memberships, audit_log,
-- admin_audit_log. RLS policies and triggers live in 0002 + 0003 so this
-- file is purely structural and can be replayed against a fresh database
-- via the same migration runner that prod uses.
--
-- Mirrors `packages/db/src/schema/*.ts` exactly. If you change a column
-- here, also change it in the matching schema file (and the rls.test.ts
-- proves the contract holds).

----------------------------------------------------------------------
-- Enums
----------------------------------------------------------------------
CREATE TYPE tenant_status AS ENUM ('active', 'suspended');

CREATE TYPE user_role AS ENUM (
  'platform_super_admin',
  'tenant_super_admin',
  'lead_gen',
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management',
  'legacy_import'
);

CREATE TYPE team_type AS ENUM ('marketing', 'advisory', 'paraplanner_pool');

CREATE TYPE membership_seat AS ENUM (
  'lead_gen',
  'adviser',
  'paraplanner',
  'uf_support',
  'ar_support',
  'ar_adviser',
  'management'
);

CREATE TYPE calendar_provider AS ENUM ('microsoft', 'google');

----------------------------------------------------------------------
-- tenants  (root table; not tenant-scoped itself)
----------------------------------------------------------------------
CREATE TABLE tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  display_name    text NOT NULL,
  primary_domain  text,
  status          tenant_status NOT NULL DEFAULT 'active',
  brand_bundle    jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_flags   jsonb NOT NULL DEFAULT '{}'::jsonb,
  enc_key_version integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

----------------------------------------------------------------------
-- users  (created_by/updated_by are self-referencing; teams.default_team_id
-- FK is added later in this file once `teams` exists)
----------------------------------------------------------------------
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  firebase_uid        text NOT NULL UNIQUE,
  email               citext NOT NULL,
  display_name        text NOT NULL,
  role                user_role NOT NULL,
  default_team_id     uuid,                                              -- FK added below
  calendar_provider   calendar_provider,
  calendar_sub_id     text,
  deactivated_at      timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT users_email_per_tenant_unique UNIQUE (tenant_id, email)
);

CREATE INDEX users_tenant_id_idx       ON users (tenant_id);
CREATE INDEX users_default_team_id_idx ON users (default_team_id) WHERE default_team_id IS NOT NULL;

----------------------------------------------------------------------
-- teams
----------------------------------------------------------------------
CREATE TABLE teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  type            team_type NOT NULL,
  brand_overrides jsonb,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  licensee        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT teams_name_per_tenant_unique UNIQUE (tenant_id, name)
);

CREATE INDEX teams_tenant_id_idx ON teams (tenant_id);

ALTER TABLE users
  ADD CONSTRAINT users_default_team_id_fkey
  FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL;

----------------------------------------------------------------------
-- team_memberships  (tenant_id denormalised — see schema/teamMemberships.ts)
----------------------------------------------------------------------
CREATE TABLE team_memberships (
  team_id     uuid NOT NULL REFERENCES teams(id)    ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  seat        membership_seat NOT NULL,
  is_primary  boolean NOT NULL DEFAULT false,
  tenant_id   uuid NOT NULL REFERENCES tenants(id)  ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (team_id, user_id, seat)
);

CREATE INDEX team_memberships_user_id_idx   ON team_memberships (user_id);
CREATE INDEX team_memberships_tenant_id_idx ON team_memberships (tenant_id);

----------------------------------------------------------------------
-- audit_log
----------------------------------------------------------------------
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id   uuid,                                              -- FK added in WP-7
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_tenant_created_idx ON audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_client_id_idx      ON audit_log (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX audit_log_type_idx           ON audit_log (type);

----------------------------------------------------------------------
-- admin_audit_log  (cross-tenant)
----------------------------------------------------------------------
CREATE TABLE admin_audit_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affected_tenant_id  uuid REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id            uuid REFERENCES users(id)   ON DELETE SET NULL,
  action              text NOT NULL,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_affected_tenant_idx ON admin_audit_log (affected_tenant_id);
CREATE INDEX admin_audit_log_actor_idx           ON admin_audit_log (actor_id);
CREATE INDEX admin_audit_log_created_idx         ON admin_audit_log (created_at DESC);
