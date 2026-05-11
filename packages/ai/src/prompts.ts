import { z } from 'zod';

/**
 * Prompt registry. The single source of truth for every Anthropic
 * call this codebase makes. Adding a new prompt is a one-line entry
 * here — the rest of the pipeline (rate-limit accounting, redaction,
 * audit row, frontend wiring) reads `PROMPT_KEY` from this map.
 *
 * REBUILD_PLAN §10.4 / §19.6.
 *
 * Each entry locks down:
 *   - `systemPrompt`     — instruction block the model always sees
 *   - `inputSchema`      — Zod schema that the SERVICE LAYER passes
 *                          BEFORE calling `runPrompt`. Caller-side
 *                          validation; the registry just declares the
 *                          contract so prompts and call-sites can't
 *                          drift.
 *   - `outputSchema`     — Zod schema for the parsed response. The
 *                          model is asked to return JSON; this checks
 *                          it. On failure the call is treated as a
 *                          retryable transport error.
 *   - `model`            — explicit model id (NOT the env default) so
 *                          version pinning is per-prompt.
 *   - `maxTokens`        — hard cap at the API level.
 *   - `temperature`      — default 0.3 for "suggest copy" prompts
 *                          (low-creativity; consistent voice).
 *   - `buildUserMessage` — pure function from `input` → user-message
 *                          string. Runs the redaction layer over
 *                          anything that might carry PII.
 *
 * The Fact Find UI surfaces an "AI assist" button per question;
 * each button binds to one PROMPT_KEY and posts the section's
 * relevant slice as `input`.
 */

export const PROMPT_KEYS = [
  'factFindGoalsNext12Months',
  'factFindGoalsNext1To5Years',
  'factFindGoalsRetirementPlan',
  'factFindGoalsSuperImportance',
  'factFindGoalsInsuranceImportance',
  'factFindGoalsSuperLumpSum',
  'factFindGoalsPreviousAdviser',
  'factFindRiskNotes',
  // ── SOA Wizard ────────────────────────────────────────────────
  // (REBUILD_PLAN §19.1.* — one key per AI-assist surface in the
  // SOA Wizard. Each takes the same `FactFindContext` shape: the
  // service layer flattens the relevant slice of the wizard
  // payload + locked Fact Find facts into `factsBullets` and
  // names the client in `displayName`.)
  'soaWizardScopeOfAdvice',
  'soaWizardPositionObservations',
  'soaWizardGoalsNarrative',
  'soaWizardStrategyRationale',
  'soaWizardInsuranceRationale',
  'soaWizardSuperRationale',
  'soaWizardInvestmentRationale',
  'soaWizardRiskProfileNotes',
] as const;
export type PromptKey = (typeof PROMPT_KEYS)[number];

interface PromptDefinition<I, O> {
  systemPrompt: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  model: string;
  maxTokens: number;
  temperature: number;
  buildUserMessage: (input: I) => string;
}

/** Default Anthropic model. Locked here so the registry lookups stay constant
 *  across runs even if the env default rolls forward. */
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

/** Generic context every Fact Find prompt receives. */
const factFindContextSchema = z.object({
  /** Display name used to address the client in suggested copy. */
  displayName: z.string().min(1).max(120),
  /** Free-text bullet list of facts the model can lean on. The
   *  service layer handcrafts this from the section payload AFTER
   *  redaction so the prompt doesn't re-leak PII. */
  factsBullets: z.array(z.string().max(2000)).max(40),
});
type FactFindContext = z.infer<typeof factFindContextSchema>;

/** All Fact Find goal/risk prompts emit a single string. */
const goalAnswerSchema = z.object({ suggestion: z.string().min(1).max(4000) });
type GoalAnswer = z.infer<typeof goalAnswerSchema>;

const baseSystemPrompt = `You are a financial-planning copywriter helping an Australian
adviser draft Fact Find narrative for a client. Output ONLY a JSON object
of the requested shape — no preamble, no markdown fences. Use Australian
English spelling and a warm, professional tone. Never invent facts not
supplied to you. If the supplied facts are insufficient, say so directly
in the suggestion.`;

const soaSystemPrompt = `You are a financial-planning copywriter helping an Australian
adviser draft a Statement of Advice (SOA) for a client. Output ONLY a JSON
object of the requested shape — no preamble, no markdown fences. Use
Australian English spelling, a professional but readable tone, and prefer
plain-English explanations over jargon. Never invent facts not supplied
to you. If the supplied facts are insufficient, say so directly in the
suggestion. Reference RG175-style language (objectives, scope, basis of
advice, risks) when the question calls for it, but stay concise.`;

const buildBulletedUserMessage = (input: FactFindContext, questionPrompt: string): string => {
  const bullets = input.factsBullets.map((b) => `- ${b}`).join('\n');
  return `Client: ${input.displayName}

Known facts:
${bullets || '- (none supplied)'}

Question: ${questionPrompt}

Respond with JSON of shape: {"suggestion": "..."}`;
};

const goalPrompt = (questionPrompt: string): PromptDefinition<FactFindContext, GoalAnswer> => ({
  systemPrompt: baseSystemPrompt,
  inputSchema: factFindContextSchema,
  outputSchema: goalAnswerSchema,
  model: DEFAULT_MODEL,
  maxTokens: 600,
  temperature: 0.3,
  buildUserMessage: (input) => buildBulletedUserMessage(input, questionPrompt),
});

/**
 * SOA Wizard prompts use the same `factFindContextSchema` input + the
 * same single-string `goalAnswerSchema` output as the Fact Find
 * prompts (so the registry stays homogeneous and the run-assist
 * service stays generic) but with the SOA-specific system prompt and
 * a slightly higher token budget for the longer rationale fields.
 */
const soaPrompt = (questionPrompt: string): PromptDefinition<FactFindContext, GoalAnswer> => ({
  systemPrompt: soaSystemPrompt,
  inputSchema: factFindContextSchema,
  outputSchema: goalAnswerSchema,
  model: DEFAULT_MODEL,
  maxTokens: 1200,
  temperature: 0.3,
  buildUserMessage: (input) => buildBulletedUserMessage(input, questionPrompt),
});

export const PROMPTS = {
  factFindGoalsNext12Months: goalPrompt(
    'Suggest a 1-2 sentence summary of what the client wants to achieve in the next 12 months.',
  ),
  factFindGoalsNext1To5Years: goalPrompt(
    'Suggest a 1-2 sentence summary of what the client wants to achieve in the next 1-5 years.',
  ),
  factFindGoalsRetirementPlan: goalPrompt(
    "Suggest a 1-2 sentence summary of the client's retirement plan and lifestyle expectations.",
  ),
  factFindGoalsSuperImportance: goalPrompt(
    'Suggest a 1-2 sentence summary of how important superannuation is to the client and why.',
  ),
  factFindGoalsInsuranceImportance: goalPrompt(
    'Suggest a 1-2 sentence summary of how important personal insurance is to the client and why.',
  ),
  factFindGoalsSuperLumpSum: goalPrompt(
    "Suggest a 1-2 sentence summary of how much the client would like to have in their super by retirement, and why that target reflects the lifestyle they're aiming for.",
  ),
  factFindGoalsPreviousAdviser: goalPrompt(
    'Suggest a 1-2 sentence summary of whether the client has previously received financial advice — note who they spoke with, what was advised, and how they felt about that experience if the facts mention it.',
  ),
  factFindRiskNotes: goalPrompt(
    "Suggest 2-3 sentences of adviser-facing notes summarising the client's risk profile answers and any nuance worth recording.",
  ),

  soaWizardScopeOfAdvice: soaPrompt(
    'Draft the "Scope of Advice" paragraph for this SOA. 3-5 sentences. Cover what the advice DOES address (e.g. super, insurance, retirement income) and any obvious limitations the adviser has flagged. Keep it concrete and tied to the supplied facts.',
  ),
  soaWizardPositionObservations: soaPrompt(
    "Draft 2-4 sentences of adviser observations about the client's current financial position. Lead with what the numbers suggest (income vs expenses, super on track, debt levels), and note any vulnerabilities a strategy should address.",
  ),
  soaWizardGoalsNarrative: soaPrompt(
    "Draft 2-3 sentences for ONE prioritised goal: explain what the client wants, why it matters, and what success looks like. Lean on the supplied goal text.",
  ),
  soaWizardStrategyRationale: soaPrompt(
    'Draft a multi-paragraph rationale for ONE strategy theme: the situation, the recommended action, why it matches the client\'s goals + risk profile, and the expected outcome. End with the headline benefit. 2-4 short paragraphs.',
  ),
  soaWizardInsuranceRationale: soaPrompt(
    "Draft 2-3 sentences explaining why the recommended cover (type + amount + structure) matches the client's needs and goals. Reference the calculated need vs current cover gap if supplied.",
  ),
  soaWizardSuperRationale: soaPrompt(
    "Draft 2-4 sentences explaining the super recommendation: why the recommended fund / consolidation / contribution mix is appropriate given the client's risk profile, fee comparison, and retirement goals.",
  ),
  soaWizardInvestmentRationale: soaPrompt(
    "Draft 2-3 sentences explaining the outside-super investment recommendation: why the platform / portfolio / contribution pattern fits the client's risk profile and goals.",
  ),
  soaWizardRiskProfileNotes: soaPrompt(
    "Draft 1-3 sentences of notes for the SOA's Risk Profile section. If a recommended profile differs from the client's measured profile, explain the rationale; otherwise confirm the profile is appropriate.",
  ),
} as const satisfies Record<PromptKey, PromptDefinition<FactFindContext, GoalAnswer>>;

export type PromptRegistry = typeof PROMPTS;
export type PromptInputOf<K extends PromptKey> = z.infer<PromptRegistry[K]['inputSchema']>;
export type PromptOutputOf<K extends PromptKey> = z.infer<PromptRegistry[K]['outputSchema']>;

export function getPrompt<K extends PromptKey>(key: K): PromptRegistry[K] {
  return PROMPTS[key];
}
