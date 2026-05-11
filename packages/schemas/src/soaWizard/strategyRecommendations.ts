import { z } from 'zod';

import { longText, shortText, uuidSchema } from './primitives.js';

/**
 * §19.1.6 `strategyRecommendations` — the bulk of the SOA narrative.
 *
 * One row per "theme" (REBUILD_PLAN §6.12, e.g. "Consolidate
 * Superannuation", "Increase Income Protection cover"). Each theme
 * becomes a Strategy subheading in the rendered SOA (§19.4.2).
 *
 * AI assist is wired against `themes[*].rationale` /
 * `themes[*].benefits` / `themes[*].considerations`
 * (`promptKey: soaWizardStrategyRationale`); the wizard fans out one
 * call per theme on bulk-Enhance.
 */
export const strategyThemeSchema = z
  .object({
    id: uuidSchema,
    title: shortText,
    /** One-sentence outcome shown in the wizard's theme card. */
    summary: longText.optional(),
    /** Multi-paragraph; AI-assist enabled. */
    rationale: longText.optional(),
    benefits: z.array(shortText).max(20).default([]),
    considerations: z.array(shortText).max(20).default([]),
    alternativesConsidered: z.array(shortText).max(20).default([]),
  })
  .strict();
export type StrategyTheme = z.infer<typeof strategyThemeSchema>;

export const strategyRecommendationsSchema = z
  .object({
    themes: z.array(strategyThemeSchema).max(20).default([]),
  })
  .strict();

export type StrategyRecommendations = z.infer<typeof strategyRecommendationsSchema>;
export const strategyRecommendationsDefault: StrategyRecommendations =
  strategyRecommendationsSchema.parse({});
