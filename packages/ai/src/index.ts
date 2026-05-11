/**
 * `@advicelink/ai` — single home for the LLM client wrapper, prompt
 * registry, redaction layer, and cost rate card.
 *
 * Per REBUILD_PLAN §10.4, every Claude call originates here. The per-
 * app service layer composes:
 *   1. `redactValue(input)` to strip PII
 *   2. `AnthropicAdapter.runPrompt(key, input)` to make the call
 *   3. `computeCostCents({ model, inputTokens, outputTokens })`
 *   4. INSERT into `ai_invocations`
 *
 * The package itself does NOT reach for the database; that keeps it
 * usable from workers and CLIs that may want to call Anthropic
 * without a tenant transaction in scope.
 */
export * from './prompts.js';
export * from './redact.js';
export * from './anthropic.js';
export * from './cost.js';
