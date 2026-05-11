/**
 * Per-model cost rate card. Cents (AUD) per 1M tokens.
 *
 * Updated whenever Anthropic publishes new pricing — historical
 * `ai_invocations.cost_cents` rows are NOT recomputed; they capture
 * the rate at call time, which is the right behaviour for finance
 * reporting.
 *
 * Rates as of 2026-01 (from anthropic.com/pricing); convert USD→AUD
 * with a conservative 1.55 multiplier so the cost figure is a
 * pessimistic ceiling.
 */

interface RateCard {
  /** Cents per 1,000,000 input tokens. */
  inputCentsPerMTokens: number;
  /** Cents per 1,000,000 output tokens. */
  outputCentsPerMTokens: number;
}

const USD_TO_AUD = 1.55;
const usd = (cents: number): number => Math.ceil(cents * USD_TO_AUD);

const RATE_CARD: Record<string, RateCard> = {
  // Claude 3.7 Sonnet — USD $3 / $15 per Mtok
  'claude-3-7-sonnet-20250219': {
    inputCentsPerMTokens: usd(300),
    outputCentsPerMTokens: usd(1500),
  },
  // Claude 3.5 Sonnet — USD $3 / $15 per Mtok
  'claude-3-5-sonnet-20241022': {
    inputCentsPerMTokens: usd(300),
    outputCentsPerMTokens: usd(1500),
  },
  // Claude 3 Haiku — USD $0.25 / $1.25 per Mtok
  'claude-3-haiku-20240307': {
    inputCentsPerMTokens: usd(25),
    outputCentsPerMTokens: usd(125),
  },
};

/**
 * Compute the cost in cents (AUD) for a single invocation. Unknown
 * models default to the most expensive Sonnet card so we never
 * underbill an experimental model id.
 */
export function computeCostCents(args: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  // Strip a `+stub` suffix added by the test-mode adapter so dev
  // numbers still aggregate cleanly with prod ones in the per-tenant
  // cost report.
  const baseModel = args.model.replace(/\+stub$/, '');
  const card = RATE_CARD[baseModel] ?? RATE_CARD['claude-3-7-sonnet-20250219']!;
  const input = (args.inputTokens / 1_000_000) * card.inputCentsPerMTokens;
  const output = (args.outputTokens / 1_000_000) * card.outputCentsPerMTokens;
  // Round up to the nearest cent — pessimistic for budget alerts.
  return Math.ceil(input + output);
}
