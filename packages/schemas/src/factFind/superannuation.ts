import { z } from 'zod';

import { moneySchema, uuidSchema } from './primitives.js';

/**
 * Superannuation (REBUILD_PLAN §7.5.5).
 *
 * v3 deliberately keeps only the five fields the live UI actually
 * collects per fund. The legacy schema carried USI, ABN, fee
 * breakdowns, defensive percent, tax components, EBA details, etc.
 * — that richer metadata is sourced from the recommended-portfolio
 * configuration (§10.6) when needed for analysis or document
 * generation, NOT from the client record.
 *
 * Max 10 funds is a hard cap enforced server-side. The portfolio
 * advisor process never references more than a handful, and a 10-fund
 * cap keeps the SOA template page count manageable.
 */

export const superFundSchema = z
  .object({
    id: uuidSchema,
    fundName: z.string().trim().max(200).optional(),
    memberNumber: z.string().trim().max(60).optional(),
    investmentOption: z.string().trim().max(200).optional(),
    currentBalance: moneySchema.default(0),
    notes: z.string().max(2000).optional(),
  })
  .strict();
export type SuperFund = z.infer<typeof superFundSchema>;

export const superannuationSchema = z
  .object({
    currentFunds: z.array(superFundSchema).max(10, 'Maximum 10 super funds').default([]),
  })
  .strict();

export type Superannuation = z.infer<typeof superannuationSchema>;
export const superannuationDefault: Superannuation = superannuationSchema.parse({
  currentFunds: [],
});
