import Anthropic from '@anthropic-ai/sdk';

import { getPrompt, type PromptInputOf, type PromptKey, type PromptOutputOf } from './prompts.js';

/**
 * Thin wrapper around `@anthropic-ai/sdk`. The wrapper:
 *   - Accepts the prompt-registry key + structured input.
 *   - Validates input against the registry's input schema.
 *   - Builds the user message via the registry's `buildUserMessage`.
 *   - Calls Anthropic and asks for JSON output.
 *   - Validates the parsed response against the registry's output schema.
 *   - Returns `{ output, model, inputTokens, outputTokens, latencyMs }`.
 *
 * The wrapper does NOT touch the database or write `ai_invocations`.
 * That belongs in the per-app service layer (`apps/api/src/services/ai`)
 * because only it has the tenant-context-aware `Db` handle.
 *
 * Test mode (`isTestMode === true`): produce a deterministic stub
 * response without calling the wire so unit tests don't need
 * `ANTHROPIC_API_KEY`. Real integration tests can opt back in by
 * passing `isTestMode: false` and a working key.
 */

export interface RunPromptResult<K extends PromptKey> {
  promptKey: K;
  output: PromptOutputOf<K>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AnthropicAdapterOptions {
  apiKey: string | undefined;
  /** When true, never hits the Anthropic API; returns a deterministic stub. */
  isTestMode?: boolean;
}

export class AnthropicAdapter {
  private readonly client: Anthropic | undefined;
  private readonly isTestMode: boolean;

  constructor(options: AnthropicAdapterOptions) {
    this.isTestMode = options.isTestMode === true || options.apiKey == null;
    this.client = this.isTestMode ? undefined : new Anthropic({ apiKey: options.apiKey });
  }

  async runPrompt<K extends PromptKey>(
    promptKey: K,
    input: PromptInputOf<K>,
  ): Promise<RunPromptResult<K>> {
    const def = getPrompt(promptKey);
    const validatedInput = def.inputSchema.parse(input) as PromptInputOf<K>;
    const userMessage = def.buildUserMessage(validatedInput);

    const start = Date.now();

    if (this.isTestMode || this.client == null) {
      // Deterministic stub. Echoes the question prompt + first fact
      // bullet so tests can assert wiring without network access.
      // The `displayName` and `factsBullets[0]` are guaranteed to
      // exist by the input schema parse above.
      const ctx = validatedInput as unknown as { displayName: string; factsBullets: string[] };
      const suggestion = `(stubbed) Suggested copy for ${ctx.displayName}: ${
        ctx.factsBullets[0] ?? 'no facts supplied'
      }`;
      const output = def.outputSchema.parse({ suggestion }) as PromptOutputOf<K>;
      return {
        promptKey,
        output,
        model: `${def.model}+stub`,
        inputTokens: Math.ceil(userMessage.length / 4),
        outputTokens: Math.ceil(suggestion.length / 4),
        latencyMs: Date.now() - start,
      };
    }

    const response = await this.client.messages.create({
      model: def.model,
      max_tokens: def.maxTokens,
      temperature: def.temperature,
      system: def.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const latencyMs = Date.now() - start;
    const text = extractText(response);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new AnthropicProtocolError(
        `Anthropic response was not valid JSON for prompt '${promptKey}': ${text.slice(0, 200)}`,
        { promptKey, rawText: text },
      );
    }

    const output = def.outputSchema.safeParse(parsedJson);
    if (!output.success) {
      throw new AnthropicProtocolError(
        `Anthropic response failed schema validation for prompt '${promptKey}'`,
        { promptKey, issues: output.error.issues },
      );
    }

    return {
      promptKey,
      output: output.data as PromptOutputOf<K>,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    };
  }
}

/** Pull the first text block out of an Anthropic message; throw if none. */
function extractText(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === 'text') return block.text;
  }
  throw new AnthropicProtocolError('Anthropic response had no text content blocks', {
    blockTypes: response.content.map((b) => b.type),
  });
}

export class AnthropicProtocolError extends Error {
  readonly meta: Record<string, unknown>;
  constructor(message: string, meta: Record<string, unknown>) {
    super(message);
    this.name = 'AnthropicProtocolError';
    this.meta = meta;
  }
}
