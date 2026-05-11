import { TRPCError } from '@trpc/server';

import { aiInvocations } from '@advicelink/db';
import {
  AnthropicAdapter,
  AnthropicProtocolError,
  computeCostCents,
  redactValue,
  type PromptInputOf,
  type PromptKey,
  type PromptOutputOf,
} from '@advicelink/ai';

import { env } from '../../config/env.js';
import type { TxDb } from '../../trpc/context.js';

/**
 * Bridge between `@advicelink/ai` (pure, DB-free) and the tenant-
 * scoped DB layer. One AnthropicAdapter is built per process at
 * module load; tenant context arrives at call time.
 *
 * Side effects per call:
 *   1. Validate input against the prompt registry's input schema.
 *   2. Redact every string in the input (defence in depth — the
 *      prompt registry's inputs already exclude direct PII fields).
 *   3. Run the prompt via the adapter (real wire OR stub mode).
 *   4. Compute cost (cents AUD) from the model's rate card.
 *   5. INSERT one row into `ai_invocations` with redacted I/O.
 *
 * Anthropic protocol errors (response not JSON, schema mismatch)
 * become `INTERNAL_SERVER_ERROR` on the tRPC envelope. Rate limit
 * / 5xx upstream errors propagate verbatim — the SDK throws
 * `Anthropic.APIError` with a status code; the caller sees a
 * meaningful error class and can decide whether to retry.
 *
 * Test-mode rules:
 *   - `NODE_ENV === 'test'` always uses the stub adapter.
 *   - Outside test, missing `ANTHROPIC_API_KEY` ALSO uses the stub.
 *     This lets a local dev run without setting the key, at the
 *     cost of obviously-stubbed copy in the UI.
 */

const adapter: AnthropicAdapter = new AnthropicAdapter({
  apiKey: env.ANTHROPIC_API_KEY,
  isTestMode: env.NODE_ENV === 'test' || env.ANTHROPIC_API_KEY == null,
});

export interface RunAssistInput<K extends PromptKey> {
  promptKey: K;
  input: PromptInputOf<K>;
  tenantId: string;
  userId: string;
  clientId?: string;
}

export interface RunAssistResult<K extends PromptKey> {
  output: PromptOutputOf<K>;
  invocationId: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
}

export async function runAssist<K extends PromptKey>(
  tx: TxDb,
  args: RunAssistInput<K>,
): Promise<RunAssistResult<K>> {
  const redactedInput = redactValue(args.input);

  let result;
  try {
    result = await adapter.runPrompt(args.promptKey, args.input);
  } catch (err) {
    if (err instanceof AnthropicProtocolError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message,
        cause: err,
      });
    }
    throw err;
  }

  const costCents = computeCostCents({
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  const [row] = await tx
    .insert(aiInvocations)
    .values({
      tenantId: args.tenantId,
      userId: args.userId,
      clientId: args.clientId ?? null,
      promptKey: args.promptKey,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costCents,
      latencyMs: result.latencyMs,
      // Output is redacted post-hoc too: Anthropic should not have
      // emitted PII (the prompt told it not to) but defence in
      // depth applies on both ends of the pipe.
      redactedInput: redactedInput as Record<string, unknown>,
      redactedOutput: redactValue(result.output) as Record<string, unknown>,
    })
    .returning({ id: aiInvocations.id });
  if (!row) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'ai_invocations insert returned no row',
    });
  }

  return {
    output: result.output,
    invocationId: row.id,
    costCents,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    model: result.model,
  };
}
