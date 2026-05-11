/**
 * PII redaction for AI prompts. Runs over every payload BEFORE it is
 * sent to Anthropic and BEFORE it is persisted into
 * `ai_invocations.redacted_input` / `redacted_output`.
 *
 * Conservative: false-positives (over-redaction) are preferred to
 * false-negatives. The only thing this layer guarantees is that no
 * obviously-PII pattern leaves the process untransformed; it is NOT
 * a substitute for the per-prompt input scrub the prompt-registry
 * authors are also expected to do (e.g. structuring inputs as
 * `{ goals: [...] }` rather than dumping the whole client row).
 *
 * The set of redactors below covers the regulator-relevant patterns
 * called out in REBUILD_PLAN §12.6:
 *   - Tax File Numbers (8-9 digit runs, often spaced)
 *   - Australian mobile numbers
 *   - Bank-style account numbers (BSB + account)
 *   - Email addresses
 *   - Plausible full names (best-effort only — see notes on `redactName`)
 */

interface Redactor {
  pattern: RegExp;
  replacement: string;
}

const REDACTORS: readonly Redactor[] = [
  // Order matters. Phone numbers are matched FIRST because an Australian
  // mobile written as `+61 412 345 678` also fits the broad TFN pattern
  // (3+3+3 digits); pulling the phone shape out preserves intent.
  // The `(?:\+?61\s?4|04)` anchor is enough to disambiguate.
  { pattern: /(?:\+?61\s?4|04)\d{2}\s?\d{3}\s?\d{3}/g, replacement: '[PHONE]' },
  // BSB + account number written together: 6-digit BSB + 6-10 digit account
  { pattern: /\b\d{3}-?\d{3}\s?\d{6,10}\b/g, replacement: '[ACCOUNT]' },
  // TFNs: 8 or 9 digits, optionally split by spaces. Runs after phone
  // so the disambiguator above already removed mobile-shaped strings.
  { pattern: /\b\d{3}\s?\d{3}\s?\d{2,3}\b/g, replacement: '[TFN]' },
  // Emails
  { pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replacement: '[EMAIL]' },
];

/**
 * Redact a single string. Returns the redacted string; never throws.
 */
export function redactString(input: string): string {
  let out = input;
  for (const { pattern, replacement } of REDACTORS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Recursive redaction over arbitrary JSON values. Dates / numbers /
 * booleans / null pass through unchanged because none can carry PII
 * by themselves; only strings and structural containers are walked.
 */
export function redactValue<T>(input: T): T {
  if (typeof input === 'string') return redactString(input) as T;
  if (Array.isArray(input)) return input.map(redactValue) as T;
  if (input != null && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      out[key] = redactValue(value);
    }
    return out as T;
  }
  return input;
}

/**
 * Redact a person's full name when it appears in a free-text string.
 * Used by the prompt builder to scrub a known set of names supplied
 * by the caller (`personal.firstName`, partner name, dependants, etc.)
 * — running a generic NER would be overkill and slow.
 *
 * Caller is responsible for de-duplicating + escaping the names; this
 * helper assumes the input is a plain person name and constructs a
 * case-insensitive whole-word match.
 */
export function redactNamesInString(text: string, names: readonly string[]): string {
  let out = text;
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[NAME]');
  }
  return out;
}
