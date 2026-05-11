import { describe, expect, it } from 'vitest';

import { AnthropicAdapter } from '../src/anthropic.js';
import { computeCostCents } from '../src/cost.js';
import { PROMPT_KEYS, PROMPTS } from '../src/prompts.js';

describe('AnthropicAdapter (stub mode)', () => {
  it('runs every Fact Find prompt key end-to-end without hitting the wire', async () => {
    const adapter = new AnthropicAdapter({ apiKey: undefined, isTestMode: true });
    for (const key of PROMPT_KEYS) {
      const result = await adapter.runPrompt(key, {
        displayName: 'Alice Smith',
        factsBullets: ['Goal: retire at 60', 'Annual income $120k'],
      });
      expect(result.promptKey).toBe(key);
      expect(result.output.suggestion).toContain('Alice Smith');
      expect(result.model).toMatch(/\+stub$/);
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
    }
  });

  it('rejects input that fails the prompt-key input schema', async () => {
    const adapter = new AnthropicAdapter({ apiKey: undefined, isTestMode: true });
    await expect(
      adapter.runPrompt('factFindGoalsNext12Months', {
        // displayName missing
        factsBullets: [],
      } as never),
    ).rejects.toThrow();
  });
});

describe('PROMPTS registry', () => {
  it('every key has a definition with a system prompt and schemas', () => {
    for (const key of PROMPT_KEYS) {
      const def = PROMPTS[key];
      expect(def.systemPrompt.length).toBeGreaterThan(50);
      expect(def.maxTokens).toBeGreaterThan(0);
      expect(typeof def.buildUserMessage).toBe('function');
    }
  });
});

describe('computeCostCents', () => {
  it('computes cost in cents using the per-model rate card', () => {
    const cost = computeCostCents({
      model: 'claude-3-7-sonnet-20250219',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // input: 300 cents * 1.55 = 465; output: 1500 * 1.55 = 2325; total = 2790
    expect(cost).toBe(2790);
  });

  it('strips the +stub suffix added by the test-mode adapter', () => {
    const a = computeCostCents({
      model: 'claude-3-7-sonnet-20250219+stub',
      inputTokens: 1000,
      outputTokens: 1000,
    });
    const b = computeCostCents({
      model: 'claude-3-7-sonnet-20250219',
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect(a).toBe(b);
  });

  it('falls back to the most-expensive Sonnet card for unknown models', () => {
    const cost = computeCostCents({
      model: 'unknown-model-xyz',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(2790);
  });
});
