-- 0006_clients.sql
-- WP-6.1: the centrepiece of v3's data model.
--
-- Adds:
--   * `clients`           — every column described in REBUILD_PLAN §7.5,
--                           including the three lead-gen tenancy
--                           pointers from §2.6 and the `display_name`
--                           generated column.
--   * `workflow_events`   — append-only audit trail for every
--                           transition the @advicelink/workflow
--                           machine accepts (§5.3 / §19.6).
--   * `ai_invocations`    — append-only ledger of every Anthropic
--                           Claude call (§7.7 / §10.4). Lays the table
--                           now so the AI assist surface can land in
--                           WP-6.3 without a follow-up migration.
--
-- All three tables enable RLS + FORCE; the `clients` policy is the
-- dual-tenant policy designed in WP-5.5 §2.6.3.
--
-- Mirrors `packages/db/src/schema/{clients,workflowEvents,aiInvocations}.ts`.

----------------------------------------------------------------------
-- Workflow enums (mirrored from @advicelink/workflow)
----------------------------------------------------------------------
CREATE TYPE workflow_state AS ENUM (
  'factFinding',
  'draftingSOA',
  'reviewingSOA',
  'amendingSOA',
  'presentingSOA',
  'welcomeCallScheduled',
  'draftingROAEO',
  'reviewingROAEO',
  'implementingAdvice',
  'insuranceAmendment',
  'waitingForAR',
  'dueForAR',
  'arBooked',
  'draftingAR',
  'reviewingAR',
  'arComplete',
  'lost'
);

CREATE TYPE workflow_phase AS ENUM (
  'factFind',
  'soaProduction',
  'presentation',
  'postAdvice',
  'complete',
  'waiting',
  'annualReview',
  'closed'
);

CREATE TYPE transition_trigger AS ENUM (
  'user',
  'system',
  'cron',
  'webhook'
);

----------------------------------------------------------------------
-- clients
----------------------------------------------------------------------
CREATE TABLE clients (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenancy: three pointers (REBUILD_PLAN §2.6.2)
  tenant_id                       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  originating_lead_gen_tenant_id  uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  destination_advice_tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

  -- Workflow
  workflow_state                  workflow_state NOT NULL DEFAULT 'factFinding',
  workflow_phase                  workflow_phase NOT NULL DEFAULT 'factFind',
  state_changed_at                timestamptz NOT NULL DEFAULT now(),

  -- Ownership
  lead_gen_team_id                uuid REFERENCES teams(id) ON DELETE SET NULL,
  advisory_team_id                uuid REFERENCES teams(id) ON DELETE SET NULL,
  assigned_adviser_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_ar_adviser_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_paraplanner_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at                      timestamptz,

  -- Key dates
  fact_find_locked_at             timestamptz,
  soa_presented_at                timestamptz,
  soa_accepted_at                 timestamptz,
  last_ar_completed_at            timestamptz,
  next_ar_date                    date,

  -- Fact Find — 12 sections; shapes owned by @advicelink/schemas (WP-6.2)
  personal                        jsonb NOT NULL DEFAULT '{}'::jsonb,
  employment                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  partner_employment              jsonb NOT NULL DEFAULT '{}'::jsonb,
  financial                       jsonb NOT NULL DEFAULT '{}'::jsonb,
  assets                          jsonb NOT NULL DEFAULT '{}'::jsonb,
  liabilities                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  superannuation                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  contributions                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  insurance                       jsonb NOT NULL DEFAULT '{}'::jsonb,
  beneficiaries                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  goals                           jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_profile                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendations                 jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Wizard outputs
  soa_wizard_data                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  roa_eo_wizard_data              jsonb NOT NULL DEFAULT '{}'::jsonb,
  ar_wizard_data                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverse_fact_find_data          jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Implementation Checklist
  implementation_progress         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Encrypted PII (pgcrypto pgp_sym_encrypt; helpers below)
  -- Stored as text (armored ascii) so Drizzle's jsonb serialisers
  -- never see binary; the encryption helpers always produce armored
  -- output for portability.
  tfn_encrypted                   text,
  partner_tfn_encrypted           text,

  -- Generated column (STORED so trigram search can index it in WP-7)
  display_name                    text NOT NULL GENERATED ALWAYS AS (
    trim(both ' ' from
      coalesce(personal->>'firstName', '')
      || ' ' ||
      coalesce(personal->>'surname', '')
    )
  ) STORED,

  -- Audit
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  created_by                      uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by                      uuid REFERENCES users(id) ON DELETE SET NULL,

  -- The active-owner tenant must always be one of the two named
  -- partners. RLS depends on this being airtight; a cheap CHECK at
  -- the row level keeps a service-layer bug from creating an orphan.
  CONSTRAINT clients_tenant_is_named_partner CHECK (
    tenant_id = destination_advice_tenant_id
    OR tenant_id = originating_lead_gen_tenant_id
  )
);

----------------------------------------------------------------------
-- Indexes
----------------------------------------------------------------------
-- Portal kanban: WHERE tenant_id = $1 AND workflow_phase = $2 ORDER BY state_changed_at DESC
CREATE INDEX clients_by_tenant_phase_idx
  ON clients (tenant_id, workflow_phase, state_changed_at DESC);

-- AR cron sweep: WHERE workflow_state IN (...) AND next_ar_date <= now()
CREATE INDEX clients_by_state_next_ar_idx
  ON clients (workflow_state, next_ar_date)
  WHERE next_ar_date IS NOT NULL;

-- Cross-tenant lead-gen reads (advice firm sees lead-gen-owned rows
-- it has been granted access to during phases 2-3)
CREATE INDEX clients_by_destination_idx
  ON clients (destination_advice_tenant_id, workflow_state);
CREATE INDEX clients_by_origin_idx
  ON clients (originating_lead_gen_tenant_id, workflow_state)
  WHERE originating_lead_gen_tenant_id IS NOT NULL;

-- Paraplanner Available / Claimed queues
CREATE INDEX clients_claimed_paraplanner_idx
  ON clients (claimed_paraplanner_id)
  WHERE claimed_paraplanner_id IS NOT NULL;

-- Trigram search across display_name for the global client picker
CREATE INDEX clients_display_name_trgm_idx
  ON clients USING gin (display_name gin_trgm_ops);

----------------------------------------------------------------------
-- Triggers on clients
----------------------------------------------------------------------
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION app_set_updated_at();

-- Keep workflow_phase in lockstep with workflow_state. The mapping is
-- the same one in @advicelink/workflow's STATE_TO_PHASE — duplicated
-- here so a bad direct UPDATE can't desync the two columns. If a
-- caller passes a workflow_phase that disagrees with the mapping,
-- the trigger silently overrides it (the typed enum guarantees
-- workflow_state is valid, and STATE_TO_PHASE is total over it).
CREATE OR REPLACE FUNCTION app_clients_sync_phase() RETURNS trigger AS $$
BEGIN
  NEW.workflow_phase := CASE NEW.workflow_state
    WHEN 'factFinding'           THEN 'factFind'::workflow_phase
    WHEN 'draftingSOA'           THEN 'soaProduction'::workflow_phase
    WHEN 'reviewingSOA'          THEN 'soaProduction'::workflow_phase
    WHEN 'amendingSOA'           THEN 'soaProduction'::workflow_phase
    WHEN 'presentingSOA'         THEN 'presentation'::workflow_phase
    WHEN 'welcomeCallScheduled'  THEN 'presentation'::workflow_phase
    WHEN 'draftingROAEO'         THEN 'postAdvice'::workflow_phase
    WHEN 'reviewingROAEO'        THEN 'postAdvice'::workflow_phase
    WHEN 'implementingAdvice'    THEN 'complete'::workflow_phase
    WHEN 'insuranceAmendment'    THEN 'complete'::workflow_phase
    WHEN 'waitingForAR'          THEN 'waiting'::workflow_phase
    WHEN 'dueForAR'              THEN 'annualReview'::workflow_phase
    WHEN 'arBooked'              THEN 'annualReview'::workflow_phase
    WHEN 'draftingAR'            THEN 'annualReview'::workflow_phase
    WHEN 'reviewingAR'           THEN 'annualReview'::workflow_phase
    WHEN 'arComplete'            THEN 'annualReview'::workflow_phase
    WHEN 'lost'                  THEN 'closed'::workflow_phase
  END;
  -- Bump the state-changed timestamp on actual transitions only.
  IF TG_OP = 'UPDATE' AND OLD.workflow_state IS DISTINCT FROM NEW.workflow_state THEN
    NEW.state_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_sync_phase
  BEFORE INSERT OR UPDATE OF workflow_state ON clients
  FOR EACH ROW EXECUTE FUNCTION app_clients_sync_phase();

-- The two named-partner tenant pointers must reference real tenants
-- of the right kinds. (Belt-and-braces for the tenant_kind enum
-- introduced in 0005.)
CREATE OR REPLACE FUNCTION app_clients_check_tenant_kinds() RETURNS trigger AS $$
DECLARE
  ad_kind tenant_kind;
  lg_kind tenant_kind;
BEGIN
  SELECT kind INTO ad_kind FROM tenants WHERE id = NEW.destination_advice_tenant_id;
  IF ad_kind IS DISTINCT FROM 'advice' THEN
    RAISE EXCEPTION
      'destination_advice_tenant_id (%) must reference a tenant with kind = advice (got %)',
      NEW.destination_advice_tenant_id, ad_kind;
  END IF;
  IF NEW.originating_lead_gen_tenant_id IS NOT NULL THEN
    SELECT kind INTO lg_kind FROM tenants WHERE id = NEW.originating_lead_gen_tenant_id;
    IF lg_kind IS DISTINCT FROM 'lead_gen' THEN
      RAISE EXCEPTION
        'originating_lead_gen_tenant_id (%) must reference a tenant with kind = lead_gen (got %)',
        NEW.originating_lead_gen_tenant_id, lg_kind;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_check_tenant_kinds
  BEFORE INSERT OR UPDATE OF destination_advice_tenant_id, originating_lead_gen_tenant_id
  ON clients
  FOR EACH ROW EXECUTE FUNCTION app_clients_check_tenant_kinds();

----------------------------------------------------------------------
-- TFN encryption helpers (REBUILD_PLAN §7.8 / §19.16)
--
-- Strategy: per-tenant symmetric key. The MASTER key lives in Doppler
-- as `DB_TFN_MASTER_KEY`; the per-tenant key is derived as
-- `hmac(master_key, tenant_id::text)` so rotating the master rotates
-- every tenant in lockstep. The application sets
-- `app.tfn_master_key` per transaction (via the same `withTenantContext`
-- helper that sets `app.current_tenant_id`); these helpers read it.
--
-- Returning NULL when input is NULL keeps callers from special-casing.
-- Errors when the master key GUC is missing are intentional — the
-- only way the call should ever proceed is via the wrapped client
-- helper that sets it.
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_tfn_master_key() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.tfn_master_key', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_tenant_tfn_key(p_tenant_id uuid) RETURNS bytea AS $$
DECLARE
  master text;
BEGIN
  master := app_tfn_master_key();
  IF master IS NULL THEN
    RAISE EXCEPTION 'app.tfn_master_key GUC is not set; call via withTenantContext';
  END IF;
  RETURN hmac(p_tenant_id::text, master, 'sha256');
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_encrypt_tfn(p_tenant_id uuid, p_plain text) RETURNS text AS $$
BEGIN
  IF p_plain IS NULL OR length(p_plain) = 0 THEN RETURN NULL; END IF;
  RETURN armor(pgp_sym_encrypt(p_plain, encode(app_tenant_tfn_key(p_tenant_id), 'hex')));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION app_decrypt_tfn(p_tenant_id uuid, p_armored text) RETURNS text AS $$
BEGIN
  IF p_armored IS NULL OR length(p_armored) = 0 THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(dearmor(p_armored), encode(app_tenant_tfn_key(p_tenant_id), 'hex'));
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION app_encrypt_tfn(uuid, text) TO app_user;
GRANT EXECUTE ON FUNCTION app_decrypt_tfn(uuid, text) TO app_user;

----------------------------------------------------------------------
-- RLS on clients — the dual-tenant policy from REBUILD_PLAN §2.6.3
--
-- Reads: any of the two named partner tenants (or platform_super_admin).
-- Per-role / per-phase narrowing happens in the service layer
-- (`assertCanAccessClient`) — RLS is the perimeter.
--
-- Writes: the active owner tenant always passes. Pre-handover, the
-- destination advice tenant can also write (the SOA-production work
-- happens on a row whose tenant_id is still the lead-gen tenant).
-- After the recordClientSigned flip, the lead-gen tenant loses write
-- access automatically because tenant_id has moved.
----------------------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

CREATE POLICY clients_read ON clients
  FOR SELECT USING (
    app_current_user_role() = 'platform_super_admin'
    OR app_current_tenant_id() IN (
      originating_lead_gen_tenant_id,
      destination_advice_tenant_id
    )
  );

CREATE POLICY clients_write ON clients
  FOR ALL USING (
    app_current_user_role() = 'platform_super_admin'
    OR app_current_tenant_id() = tenant_id
    OR (
      app_current_tenant_id() = destination_advice_tenant_id
      AND tenant_id = originating_lead_gen_tenant_id
    )
  )
  WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR app_current_tenant_id() = tenant_id
    OR (
      app_current_tenant_id() = destination_advice_tenant_id
      AND tenant_id = originating_lead_gen_tenant_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO app_user;

----------------------------------------------------------------------
-- workflow_events
----------------------------------------------------------------------
CREATE TABLE workflow_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  from_state          workflow_state,
  to_state            workflow_state NOT NULL,
  transition_name     text NOT NULL,
  trigger             transition_trigger NOT NULL,
  actor_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_tenant_id     uuid REFERENCES tenants(id) ON DELETE SET NULL,
  reason              text,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workflow_events_by_client_idx
  ON workflow_events (client_id, created_at);
CREATE INDEX workflow_events_by_tenant_idx
  ON workflow_events (tenant_id, created_at);

-- Append-only enforcement (same trigger as audit_log / admin_audit_log)
CREATE TRIGGER workflow_events_no_delete BEFORE DELETE ON workflow_events
  FOR EACH ROW EXECUTE FUNCTION app_block_audit_delete();

ALTER TABLE workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_events FORCE ROW LEVEL SECURITY;

CREATE POLICY workflow_events_read ON workflow_events
  FOR SELECT USING (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
    OR EXISTS (
      SELECT 1 FROM clients c
       WHERE c.id = workflow_events.client_id
         AND app_current_tenant_id() IN (
           c.originating_lead_gen_tenant_id,
           c.destination_advice_tenant_id
         )
    )
  );

CREATE POLICY workflow_events_insert ON workflow_events
  FOR INSERT WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
    OR (
      -- Cross-tenant write: an actor in the destination advice tenant
      -- recording a transition on a lead-gen-owned row during phases
      -- 2-3. The row.tenant_id stays as the lead-gen tenant.
      actor_tenant_id = app_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM clients c
         WHERE c.id = workflow_events.client_id
           AND c.destination_advice_tenant_id = app_current_tenant_id()
      )
    )
  );

GRANT SELECT, INSERT ON workflow_events TO app_user;

----------------------------------------------------------------------
-- ai_invocations
----------------------------------------------------------------------
CREATE TABLE ai_invocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  prompt_key      text NOT NULL,
  model           text NOT NULL,
  input_tokens    integer NOT NULL,
  output_tokens   integer NOT NULL,
  cost_cents      integer NOT NULL,
  latency_ms      integer NOT NULL,
  redacted_input  jsonb NOT NULL DEFAULT '{}'::jsonb,
  redacted_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_invocations_by_tenant_idx
  ON ai_invocations (tenant_id, created_at);
CREATE INDEX ai_invocations_by_prompt_idx
  ON ai_invocations (tenant_id, prompt_key);

CREATE TRIGGER ai_invocations_no_delete BEFORE DELETE ON ai_invocations
  FOR EACH ROW EXECUTE FUNCTION app_block_audit_delete();

ALTER TABLE ai_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_invocations FORCE ROW LEVEL SECURITY;

CREATE POLICY ai_invocations_read ON ai_invocations
  FOR SELECT USING (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );

CREATE POLICY ai_invocations_insert ON ai_invocations
  FOR INSERT WITH CHECK (
    app_current_user_role() = 'platform_super_admin'
    OR tenant_id = app_current_tenant_id()
  );

GRANT SELECT, INSERT ON ai_invocations TO app_user;
