/**
 * SOA Wizard — 15 section schemas.
 *
 * Every section's data lives under `clients.soa_wizard_data.<sectionKey>`.
 * Each schema accepts partial saves so the wizard's autosave can
 * persist mid-edit drafts; the "ready-to-render-the-SOA-DOCX" gate
 * is enforced by a separate helper (lands with WP-9's render
 * pipeline) — these schemas are the storage contract.
 *
 * REBUILD_PLAN §6.12 (UI), §19.1 (per-section shapes), §19.4.2
 * (DOCX placeholder mapping).
 *
 * Section list (in wizard sub-nav order):
 *   1.  cover
 *   2.  aboutAuthority
 *   3.  goals
 *   4.  position                — auto-populated from the locked Fact Find
 *   5.  riskProfile
 *   6.  strategyRecommendations
 *   7.  insuranceRecommendations
 *   8.  superRecommendations
 *   9.  investmentRecommendations
 *   10. cashflowModelling
 *   11. projections
 *   12. feesCosts
 *   13. implementationPlan
 *   14. authorityToProceed
 *   15. appendices
 */
export * from './primitives.js';
export * from './cover.js';
export * from './aboutAuthority.js';
export * from './goals.js';
export * from './position.js';
export * from './riskProfile.js';
export * from './strategyRecommendations.js';
export * from './insuranceRecommendations.js';
export * from './superRecommendations.js';
export * from './investmentRecommendations.js';
export * from './cashflowModelling.js';
export * from './projections.js';
export * from './feesCosts.js';
export * from './implementationPlan.js';
export * from './authorityToProceed.js';
export * from './appendices.js';

import { aboutAuthorityDefault, aboutAuthoritySchema } from './aboutAuthority.js';
import { appendicesDefault, appendicesSchema } from './appendices.js';
import { authorityToProceedDefault, authorityToProceedSchema } from './authorityToProceed.js';
import { cashflowModellingDefault, cashflowModellingSchema } from './cashflowModelling.js';
import { coverDefault, coverSchema } from './cover.js';
import { feesCostsDefault, feesCostsSchema } from './feesCosts.js';
import { goalsDefault, goalsSchema } from './goals.js';
import {
  implementationPlanDefault,
  implementationPlanSchema,
} from './implementationPlan.js';
import {
  insuranceRecommendationsDefault,
  insuranceRecommendationsSchema,
} from './insuranceRecommendations.js';
import {
  investmentRecommendationsDefault,
  investmentRecommendationsSchema,
} from './investmentRecommendations.js';
import { positionDefault, positionSchema } from './position.js';
import { projectionsDefault, projectionsSchema } from './projections.js';
import { riskProfileDefault, riskProfileSchema } from './riskProfile.js';
import {
  strategyRecommendationsDefault,
  strategyRecommendationsSchema,
} from './strategyRecommendations.js';
import {
  superRecommendationsDefault,
  superRecommendationsSchema,
} from './superRecommendations.js';

/**
 * Stable section identifiers. Used by the tRPC `soaWizard.upsertSection`
 * input as a discriminator and by the frontend nav. Order matches the
 * wizard sub-nav.
 */
export const SOA_WIZARD_SECTION_IDS = [
  'cover',
  'aboutAuthority',
  'goals',
  'position',
  'riskProfile',
  'strategyRecommendations',
  'insuranceRecommendations',
  'superRecommendations',
  'investmentRecommendations',
  'cashflowModelling',
  'projections',
  'feesCosts',
  'implementationPlan',
  'authorityToProceed',
  'appendices',
] as const;
export type SoaWizardSectionId = (typeof SOA_WIZARD_SECTION_IDS)[number];

/**
 * Lookup table from section id → its Zod schema. Single source of
 * truth used by the service layer to validate any inbound section
 * payload without a switch statement.
 */
export const soaWizardSectionSchemas = {
  cover: coverSchema,
  aboutAuthority: aboutAuthoritySchema,
  goals: goalsSchema,
  position: positionSchema,
  riskProfile: riskProfileSchema,
  strategyRecommendations: strategyRecommendationsSchema,
  insuranceRecommendations: insuranceRecommendationsSchema,
  superRecommendations: superRecommendationsSchema,
  investmentRecommendations: investmentRecommendationsSchema,
  cashflowModelling: cashflowModellingSchema,
  projections: projectionsSchema,
  feesCosts: feesCostsSchema,
  implementationPlan: implementationPlanSchema,
  authorityToProceed: authorityToProceedSchema,
  appendices: appendicesSchema,
} as const;

/**
 * Default empty value for each section. Used by the service layer
 * when `soa_wizard_data` is `{}` (every fresh client) and by tests.
 */
export const soaWizardSectionDefaults = {
  cover: coverDefault,
  aboutAuthority: aboutAuthorityDefault,
  goals: goalsDefault,
  position: positionDefault,
  riskProfile: riskProfileDefault,
  strategyRecommendations: strategyRecommendationsDefault,
  insuranceRecommendations: insuranceRecommendationsDefault,
  superRecommendations: superRecommendationsDefault,
  investmentRecommendations: investmentRecommendationsDefault,
  cashflowModelling: cashflowModellingDefault,
  projections: projectionsDefault,
  feesCosts: feesCostsDefault,
  implementationPlan: implementationPlanDefault,
  authorityToProceed: authorityToProceedDefault,
  appendices: appendicesDefault,
} as const;
