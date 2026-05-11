import { sql } from 'drizzle-orm';
import { date, jsonb, pgTable, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

import { workflowPhase, workflowState } from './enums.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `clients` is the centrepiece of the data model. Every other client-
 * scoped table (envelopes, file_notes, client_documents, workflow_events,
 * implementation_progress entries, etc.) FKs back here.
 *
 * REBUILD_PLAN §7.5. Three tenant pointers live on the row to support
 * the WP-5.5 lead-gen tenancy model (§2.6):
 *
 *  - `originating_lead_gen_tenant_id` — the agency that captured the
 *    lead. Set at creation, never modified. Nullable for self-sourced
 *    clients (advice firm captured the lead directly).
 *  - `destination_advice_tenant_id` — the advice firm the lead is sold
 *    to. Set at creation, never modified. Required when the creator is
 *    a `lead_gen` user (validated in the service layer against
 *    `lead_gen_grants`).
 *  - `tenant_id` — the **active owner**. Equals the lead-gen tenant
 *    during phases 1–3 (factFinding through presentingSOA); flips to
 *    the advice tenant inside the DocuSign `recordClientSigned`
 *    webhook handler in the same transaction as the workflow advance.
 *    Terminal `lost` rows keep the lead-gen tenant.
 *
 * Workflow + claim columns mirror the WP-5/5.5 contract
 * (`@advicelink/workflow`). The 10 Fact Find sections are JSONB blobs
 * whose shape is owned by `@advicelink/schemas` (lands in WP-6.2);
 * here we keep them as untyped `jsonb` so the schema package owns the
 * single source of truth for shapes.
 *
 * `display_name` is a Postgres GENERATED ALWAYS column built from
 * `personal->>'firstName'` + `personal->>'surname'` so portal kanban
 * queries don't have to repeat the coalesce. Kept STORED rather than
 * VIRTUAL so it can be indexed for trigram search (WP-7).
 */
export const clients = pgTable('clients', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // ── Tenancy ──────────────────────────────────────────────────────
  /** Active owner. Flips at recordClientSigned. */
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),
  /** Original capturer; immutable. NULL for self-sourced. */
  originatingLeadGenTenantId: uuid('originating_lead_gen_tenant_id').references(() => tenants.id, {
    onDelete: 'restrict',
  }),
  /**
   * Destination advice firm; immutable. Required when the creator is
   * a lead_gen user; validated against `lead_gen_grants` in the
   * service layer. Equal to `tenant_id` for self-sourced clients.
   */
  destinationAdviceTenantId: uuid('destination_advice_tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'restrict' }),

  // ── Workflow ─────────────────────────────────────────────────────
  /** XState state id; e.g. 'factFinding', 'draftingSOA'. */
  workflowState: workflowState('workflow_state').notNull().default('factFinding'),
  /** Macro phase; denormalised for portal kanban queries. */
  workflowPhase: workflowPhase('workflow_phase').notNull().default('factFind'),
  stateChangedAt: timestamp('state_changed_at', { withTimezone: true }).notNull().defaultNow(),

  // ── Ownership ────────────────────────────────────────────────────
  leadGenTeamId: uuid('lead_gen_team_id').references(() => teams.id, { onDelete: 'set null' }),
  advisoryTeamId: uuid('advisory_team_id').references(() => teams.id, { onDelete: 'set null' }),
  assignedAdviserId: uuid('assigned_adviser_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  assignedArAdviserId: uuid('assigned_ar_adviser_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  /**
   * The paraplanner who has currently claimed this client; cleared
   * by `auto-paraplanner-release` after `tenant.config.paraplanner_release_window`
   * (default 48h) of inactivity in `draftingSOA` or `amendingSOA`
   * (REBUILD_PLAN §4.5). The claim is data, not a workflow state.
   */
  claimedParaplannerId: uuid('claimed_paraplanner_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),

  // ── Key dates ────────────────────────────────────────────────────
  factFindLockedAt: timestamp('fact_find_locked_at', { withTimezone: true }),
  soaPresentedAt: timestamp('soa_presented_at', { withTimezone: true }),
  soaAcceptedAt: timestamp('soa_accepted_at', { withTimezone: true }),
  lastArCompletedAt: timestamp('last_ar_completed_at', { withTimezone: true }),
  /**
   * The cadence target. Set by the DocuSign webhook on every CSA
   * signing (initial onboarding pack OR an AR Pack) via
   * `computeNextArDueDate(csaSignedAt, tenant.config.ar_default_offset_months)`.
   * Default cadence is 10 months (DEFAULT_AR_CADENCE_MONTHS).
   */
  nextArDate: date('next_ar_date'),

  // ── Fact Find (10 sections; shapes in @advicelink/schemas / WP-6.2).
  // Two historical entries — `recommendations` and `partner_employment`
  // / `liabilities` — were dropped (WP-7 / WP-7 follow-up). Recommendations
  // belong on `soa_wizard_data`; partner employment is captured on
  // `personal.partner*`; standalone debts live as zero-value asset
  // rows with `amountOwing > 0` so the projection engine can see one
  // unified debt list.
  personal: jsonb('personal')
    .notNull()
    .default(sql`'{}'::jsonb`),
  /** Captures both primary and (via personal.partner*) partner employment. */
  employment: jsonb('employment')
    .notNull()
    .default(sql`'{}'::jsonb`),
  financial: jsonb('financial')
    .notNull()
    .default(sql`'{}'::jsonb`),
  /** Doubles as the liabilities store: a row with assetValue=0 and
   *  amountOwing>0 is a standalone debt. */
  assets: jsonb('assets')
    .notNull()
    .default(sql`'{}'::jsonb`),
  /** 5 fields per fund; max 10 funds; enforced in @advicelink/schemas. */
  superannuation: jsonb('superannuation')
    .notNull()
    .default(sql`'{}'::jsonb`),
  contributions: jsonb('contributions')
    .notNull()
    .default(sql`'{}'::jsonb`),
  insurance: jsonb('insurance')
    .notNull()
    .default(sql`'{}'::jsonb`),
  beneficiaries: jsonb('beneficiaries')
    .notNull()
    .default(sql`'{}'::jsonb`),
  goals: jsonb('goals')
    .notNull()
    .default(sql`'{}'::jsonb`),
  riskProfile: jsonb('risk_profile')
    .notNull()
    .default(sql`'{}'::jsonb`),

  // ── Wizard outputs (one top-level key per wizard section) ────────
  soaWizardData: jsonb('soa_wizard_data')
    .notNull()
    .default(sql`'{}'::jsonb`),
  roaEoWizardData: jsonb('roa_eo_wizard_data')
    .notNull()
    .default(sql`'{}'::jsonb`),
  arWizardData: jsonb('ar_wizard_data')
    .notNull()
    .default(sql`'{}'::jsonb`),
  reverseFactFindData: jsonb('reverse_fact_find_data')
    .notNull()
    .default(sql`'{}'::jsonb`),

  // ── Implementation Checklist (§7.6) ──────────────────────────────
  implementationProgress: jsonb('implementation_progress')
    .notNull()
    .default(sql`'{}'::jsonb`),

  // ── Encrypted PII ────────────────────────────────────────────────
  /**
   * TFN (and partner TFN) are encrypted at rest with a per-tenant key
   * via `pgcrypto.pgp_sym_encrypt`. The application layer never reads
   * the encrypted bytes directly; the service uses
   * `db_encrypt_tfn(tenant_id, plaintext)` /
   * `db_decrypt_tfn(tenant_id, ciphertext)` helpers (lands in WP-6.3,
   * REBUILD_PLAN §7.8 / §19.16). Stored as `bytea` rather than text
   * so Drizzle never accidentally serialises the ciphertext into JSON.
   */
  tfnEncrypted: text('tfn_encrypted'),
  partnerTfnEncrypted: text('partner_tfn_encrypted'),

  // ── Generated column ─────────────────────────────────────────────
  /**
   * Built from `personal.firstName` + `personal.surname`. Kept STORED
   * (not VIRTUAL) so portal trigram search can index it (WP-7). The
   * `.generatedAlwaysAs()` chain teaches Drizzle to omit this column
   * from `$inferInsert`; the canonical SQL expression is asserted in
   * the migration because Drizzle currently doesn't introspect this
   * back during `db:check` (we accept the small drift — the SQL is
   * the source of truth).
   */
  displayName: text('display_name')
    .notNull()
    .generatedAlwaysAs(
      sql`trim(both ' ' from coalesce(personal->>'firstName','') || ' ' || coalesce(personal->>'surname',''))`,
    ),

  // ── Audit ────────────────────────────────────────────────────────
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references((): AnyPgColumn => users.id, {
    onDelete: 'set null',
  }),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, {
    onDelete: 'set null',
  }),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
