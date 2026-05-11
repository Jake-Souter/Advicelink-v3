import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { clients } from './clients.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Audit of every Anthropic Claude (or future model) invocation. One
 * row per request — no batching, no aggregation.
 *
 * REBUILD_PLAN §7.7 + §10.4. Used by:
 *  - the per-tenant cost-by-day report (admin),
 *  - the global rate-limiter (which derives the per-user / per-tenant
 *    quota window from the last hour of rows),
 *  - PostHog opt-out auditing (the redacted_input column proves we
 *    redacted before sending; real plaintext never lands here).
 *
 * `redacted_input` and `redacted_output` capture what was sent /
 * received AFTER PII redaction (TFNs replaced with `[TFN]`, full
 * names with `[NAME]`, etc.). The redactor lives in
 * `packages/ai/src/redact.ts` (lands in WP-6.3 alongside the prompt
 * registry); these columns assume the redactor ran and any plaintext
 * leakage is a bug, not a UX choice.
 *
 * Append-only via the existing `app_block_audit_delete` trigger;
 * registered for this table in 0006_clients.sql.
 */
export const aiInvocations = pgTable(
  'ai_invocations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'restrict' }),

    /** Optional: not every prompt is client-scoped (e.g. tenant-wide
     *  "summarise our pipeline" admin prompts). */
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),

    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    /**
     * Stable name from the prompt registry; e.g. `factFindGoals`,
     * `insuranceExplanation`. Renaming a prompt is a breaking change
     * (the cost-by-prompt report depends on this), so the registry
     * lives in `packages/ai/src/prompts.ts` and is the single
     * source of truth.
     */
    promptKey: text('prompt_key').notNull(),

    /** e.g. 'claude-3-5-sonnet-20241022'; the exact value sent to Anthropic. */
    model: text('model').notNull(),

    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),

    /** Cents (integer; AUD). Computed at call time from the model's
     *  rate card so historical rows survive Anthropic price changes. */
    costCents: integer('cost_cents').notNull(),

    latencyMs: integer('latency_ms').notNull(),

    /** Post-redaction. NEVER write plaintext PII here. */
    redactedInput: jsonb('redacted_input')
      .notNull()
      .default(sql`'{}'::jsonb`),
    redactedOutput: jsonb('redacted_output')
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byTenantIdx: index('ai_invocations_by_tenant_idx').on(table.tenantId, table.createdAt),
    byPromptIdx: index('ai_invocations_by_prompt_idx').on(table.tenantId, table.promptKey),
  }),
);

export type AiInvocation = typeof aiInvocations.$inferSelect;
export type NewAiInvocation = typeof aiInvocations.$inferInsert;
