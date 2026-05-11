import { z } from 'zod';

import { percentageSchema } from './primitives.js';

/**
 * Employment section (REBUILD_PLAN §7.5.2).
 *
 * Stored on `clients.employment` for the primary client. Partner
 * employment is captured on `personal.partner*` (employer/occupation)
 * — the dedicated `partner_employment` column was dropped in WP-7
 * follow-up because the duplication had no downstream consumer.
 *
 * The hours-of-leave fields appear on the SOA insurance section so
 * the adviser can quickly see how many weeks of cover the client
 * already has. Stored as raw hours; conversion to weeks happens in
 * the document template, not here.
 */

export const employmentStatusSchema = z.enum([
  'Full-time',
  'Part-time',
  'Casual',
  'Self-employed',
  'Contractor',
  'Unemployed',
  'Retired',
  'Home duties',
  'Student',
]);
export type EmploymentStatus = z.infer<typeof employmentStatusSchema>;

const hoursSchema = z.number().finite().min(0).max(20_000);

export const employmentSchema = z
  .object({
    occupation: z.string().trim().max(200).optional(),
    employer: z.string().trim().max(200).optional(),
    employmentStatus: employmentStatusSchema.optional(),
    percentageWorkInOffice: percentageSchema.optional(),
    workDuties: z.string().max(4000).optional(),

    annualLeaveAccruedHours: hoursSchema.optional(),
    sickLeaveAccruedHours: hoursSchema.optional(),
    longServiceLeaveAccruedHours: hoursSchema.optional(),

    worksWithHazardousMaterials: z.boolean().optional(),
    worksAtHeightsOver12m: z.boolean().optional(),
  })
  .strict();

export type Employment = z.infer<typeof employmentSchema>;
export const employmentDefault: Employment = employmentSchema.parse({});
