/**
 * Fact Find — 12 section schemas + server-side derivation helpers.
 * The frontend imports inferred types via the tRPC client; service
 * code imports the schemas + derivations directly.
 *
 * REBUILD_PLAN §7.5 (shapes), §11.1 (lock requirements), §17 (Zod
 * conventions).
 *
 * Section list (in Fact Find UI order):
 *   1.  personal
 *   2.  employment + partnerEmployment
 *   3.  financial
 *   4.  assets
 *   5.  liabilities
 *   6.  superannuation
 *   7.  contributions
 *   8.  insurance
 *   9.  beneficiaries
 *  10.  goals
 *  11.  riskProfile
 *
 * `recommendations` was previously listed here as section 12; it was
 * removed in WP-7 because recommendations are an SOA Production
 * output, not a Fact Find input. Their canonical home is
 * `clients.soa_wizard_data` (shapes will land alongside the SOA
 * Wizard schemas in WP-8).
 */
export * from './primitives.js';
export * from './personal.js';
export * from './employment.js';
export * from './financial.js';
export * from './assets.js';
export * from './liabilities.js';
export * from './superannuation.js';
export * from './contributions.js';
export * from './insurance.js';
export * from './beneficiaries.js';
export * from './goals.js';
export * from './riskProfile.js';
export * from './derivations.js';

import { assetsDefault, assetsSchema } from './assets.js';
import { beneficiariesDefault, beneficiariesSchema } from './beneficiaries.js';
import { contributionsDefault, contributionsSchema } from './contributions.js';
import { employmentDefault, employmentSchema, partnerEmploymentSchema } from './employment.js';
import { financialDefault, financialSchema } from './financial.js';
import { goalsDefault, goalsSchema } from './goals.js';
import { insuranceDefault, insuranceSchema } from './insurance.js';
import { liabilitiesDefault, liabilitiesSchema } from './liabilities.js';
import { personalDefault, personalSchema } from './personal.js';
import { riskProfileDefault, riskProfileSchema } from './riskProfile.js';
import { superannuationDefault, superannuationSchema } from './superannuation.js';

/**
 * Stable section identifiers. Used by the tRPC `factFind.upsertSection`
 * input as a discriminator and by the frontend nav. Order matches the
 * Fact Find wizard UI.
 */
export const FACT_FIND_SECTION_IDS = [
  'personal',
  'employment',
  'partnerEmployment',
  'financial',
  'assets',
  'liabilities',
  'superannuation',
  'contributions',
  'insurance',
  'beneficiaries',
  'goals',
  'riskProfile',
] as const;
export type FactFindSectionId = (typeof FACT_FIND_SECTION_IDS)[number];

/**
 * Lookup table from section id → its Zod schema. Single source of
 * truth used by the service layer to validate any inbound section
 * payload without a switch statement.
 */
export const factFindSectionSchemas = {
  personal: personalSchema,
  employment: employmentSchema,
  partnerEmployment: partnerEmploymentSchema,
  financial: financialSchema,
  assets: assetsSchema,
  liabilities: liabilitiesSchema,
  superannuation: superannuationSchema,
  contributions: contributionsSchema,
  insurance: insuranceSchema,
  beneficiaries: beneficiariesSchema,
  goals: goalsSchema,
  riskProfile: riskProfileSchema,
} as const;

/**
 * Default empty value for each section, matching the JSONB column
 * defaults in `0006_clients.sql`. Used by the service layer when a
 * fresh client is created and by the test fixtures.
 */
export const factFindSectionDefaults = {
  personal: personalDefault,
  employment: employmentDefault,
  partnerEmployment: employmentDefault,
  financial: financialDefault,
  assets: assetsDefault,
  liabilities: liabilitiesDefault,
  superannuation: superannuationDefault,
  contributions: contributionsDefault,
  insurance: insuranceDefault,
  beneficiaries: beneficiariesDefault,
  goals: goalsDefault,
  riskProfile: riskProfileDefault,
} as const;
