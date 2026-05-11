import { z } from 'zod';

import { longText, reviewCadenceSchema, shortText, uuidSchema } from './primitives.js';

/**
 * §19.1.3 `goals` — the SOA's goals section. Mirrors `clients.goals`
 * (the Fact Find shape) and adds adviser-curated prioritisation.
 *
 * The prioritisation array is the source of truth for the SOA's "Your
 * Goals" output: each row gets its own subheading in the document
 * (§19.4.2). `goalKey` is a free string so the adviser can prioritise
 * either a Fact Find question key (`next12Months`) or a custom theme
 * coined just for the SOA.
 *
 * AI assist is wired against `prioritisation[*].narrative`
 * (`promptKey: soaWizardGoalsNarrative`); the bulk Enhance fans out
 * one call per row.
 */

export const prioritisedGoalSchema = z
  .object({
    id: uuidSchema,
    /** Either a Fact Find goals.* key or an adviser-coined theme. */
    goalKey: shortText,
    priority: z.number().int().min(1).max(20),
    narrative: longText.optional(),
  })
  .strict();

export type PrioritisedGoal = z.infer<typeof prioritisedGoalSchema>;

export const goalsSchema = z
  .object({
    prioritisation: z.array(prioritisedGoalSchema).max(20).default([]),
    agreedReviewCadence: reviewCadenceSchema.optional(),
  })
  .strict();

export type Goals = z.infer<typeof goalsSchema>;
export const goalsDefault: Goals = goalsSchema.parse({});
