import { z } from 'zod';

import { ownerRoleSchema, shortText, uuidSchema } from './primitives.js';

/**
 * §19.1.13 `implementationPlan`.
 *
 * Drives the SOA's "Implementation Plan" section + seeds the per-client
 * Implementation Checklist (§7.6 + §6.15) when the SOA is finalised.
 *
 * `dependsOn` is a list of stepNumbers the row gates on; the rendering
 * step orders the steps by stepNumber so the dependency arrows in
 * the SOA stay readable. We keep stepNumber as a plain integer rather
 * than uuid because advisers reorder rows during drafting and the
 * numbers carry semantic meaning ("Step 1: Sign engagement letter").
 */
export const implementationStepSchema = z
  .object({
    id: uuidSchema,
    stepNumber: z.number().int().min(1).max(200),
    title: shortText,
    ownerRole: ownerRoleSchema.optional(),
    /** Free-text e.g. "Within 2 weeks". */
    estimatedTimeline: shortText.optional(),
    dependsOn: z.array(z.number().int().min(1).max(200)).max(10).default([]),
  })
  .strict();
export type ImplementationStep = z.infer<typeof implementationStepSchema>;

export const implementationPlanSchema = z
  .object({
    steps: z.array(implementationStepSchema).max(80).default([]),
  })
  .strict();

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
export const implementationPlanDefault: ImplementationPlan = implementationPlanSchema.parse({});
