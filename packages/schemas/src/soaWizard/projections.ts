import { z } from 'zod';

import { moneySchema, projectionScenarioSchema, uuidSchema } from './primitives.js';
import { percentageSchema } from '../factFind/primitives.js';

/**
 * §19.1.11 `projections` — snapshot of the projection run pinned to
 * this SOA. The full year-by-year matrix lives on `projection_runs.
 * results`; this section quotes the headline numbers + assumptions
 * the SOA's body cites.
 *
 * `projectionRunId` is the FK back to `projection_runs`; populated by
 * the projection sandbox flow when the adviser pins a run from
 * `/projections` or runs one inline. `outputSummary` is server-derived
 * (the projection engine writes it back into the wizard slot when
 * the run is pinned), so the editor renders it read-only.
 */
export const projectionAssumptionsSchema = z
  .object({
    cpiPercent: percentageSchema.optional(),
    returnsPercent: percentageSchema.optional(),
    feesPercent: percentageSchema.optional(),
    superTaxConcessional: percentageSchema.optional(),
    drawdownStrategy: z.enum(['minimum', 'desired-income', 'fixed-amount']).optional(),
  })
  .strict();
export type ProjectionAssumptions = z.infer<typeof projectionAssumptionsSchema>;

export const projectionOutputSummarySchema = z
  .object({
    balanceAtRetirement: moneySchema.optional(),
    balanceAtAge90: moneySchema.optional(),
    yearsCoveredAtTargetIncome: z.number().min(0).max(120).optional(),
  })
  .strict();
export type ProjectionOutputSummary = z.infer<typeof projectionOutputSummarySchema>;

export const projectionsSchema = z
  .object({
    projectionRunId: uuidSchema.optional(),
    /** Defaults to ['baseline','recommended'] but kept editable so a
     *  scenario-comparison SOA can use a custom pair. */
    scenarios: z.array(projectionScenarioSchema).max(2).default(['baseline', 'recommended']),
    startAge: z.number().int().min(18).max(100).optional(),
    retirementAge: z.number().int().min(40).max(90).optional(),
    /** Default 95 (REBUILD_PLAN §19.1.11). */
    endAge: z.number().int().min(60).max(120).optional(),
    assumptions: projectionAssumptionsSchema.optional(),
    outputSummary: projectionOutputSummarySchema.optional(),
  })
  .strict();

export type Projections = z.infer<typeof projectionsSchema>;
export const projectionsDefault: Projections = projectionsSchema.parse({});
