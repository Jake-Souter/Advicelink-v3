/**
 * Anthropic Claude client + prompt registry runtime.
 *
 * The single entrypoint `callClaude(promptKey, inputs, ctx)` ships in Work
 * Package 8 (SOA Wizard) when AI assist is wired into the first wizard
 * section. See REBUILD_PLAN.md §9.4, §10.4, §19.12.9 for the full behaviour:
 * registry lookup, PII redaction, audit row in `ai_invocations`, tenant
 * monthly token budget enforcement.
 *
 * No prompt strings may be inlined in feature code — they all live in
 * `./registry.ts`.
 */
export type PromptKey = string; // narrowed once the registry is populated

export interface CallClaudeContext {
  tenantId: string;
  userId: string;
  clientId?: string;
}
