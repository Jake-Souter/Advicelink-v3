import { z } from 'zod';

import { frequencySchema, isoDateSchema, moneySchema, signedMoneySchema } from '../factFind/primitives.js';

/**
 * SOA Wizard primitives — shared building blocks across the 15
 * `soaWizard.<section>` schemas (REBUILD_PLAN §6.12 + §19.1).
 *
 * Conventions
 * -----------
 *  * Sections accept partial saves: nearly every field is `optional()`
 *    so the wizard's autosave can persist mid-edit drafts. The
 *    "ready-to-render-the-SOA-DOCX" gate is enforced by a separate
 *    helper (`assertReadyToFinaliseSoa`, lands when WP-9's render
 *    pipeline lands) — these schemas are the storage contract.
 *  * IDs (e.g. theme.id, step.stepNumber, fund.id) are uuids generated
 *    client-side so optimistic UI works without a server round-trip.
 *  * Money / percent / frequency primitives come from `factFind/primitives`
 *    so the SOA Wizard never re-defines a unit that the Fact Find
 *    already owns.
 *  * `meta` fields prefixed with `_` are wizard-only: they live on the
 *    section payload but never make it into the rendered DOCX
 *    (ignored by §19.4's placeholder map).
 */

export const uuidSchema = z.string().uuid();

export { frequencySchema, isoDateSchema, moneySchema, signedMoneySchema };

/** Reusable "draft-friendly" string. Trim is left to the form layer. */
export const longText = z.string().max(8000);
export const shortText = z.string().max(500);

/**
 * The four AU advice basis options. Mirrors the legacy SOA codebase
 * (REBUILD_PLAN §19.1.2). `scaled` is the v3-only addition that the
 * production team uses for industry-fund "limited-scope" SOAs.
 */
export const basisOfAdviceSchema = z.enum(['comprehensive', 'limited', 'scaled']);
export type BasisOfAdvice = z.infer<typeof basisOfAdviceSchema>;

export const feeForServiceModelSchema = z.enum(['fixed', 'asset-based', 'hybrid']);
export type FeeForServiceModel = z.infer<typeof feeForServiceModelSchema>;

export const reviewCadenceSchema = z.enum(['annual', 'semi-annual', 'quarterly']);
export type ReviewCadence = z.infer<typeof reviewCadenceSchema>;

export const ownerRoleSchema = z.enum(['client', 'adviser', 'ar_support', 'paraplanner']);
export type OwnerRole = z.infer<typeof ownerRoleSchema>;

export const recommendedStructureSchema = z.enum(['Inside Super', 'Outside Super', 'Hybrid']);
export type RecommendedStructure = z.infer<typeof recommendedStructureSchema>;

export const recommendedPremiumTypeSchema = z.enum(['Stepped', 'Level', 'Hybrid']);
export type RecommendedPremiumType = z.infer<typeof recommendedPremiumTypeSchema>;

export const tpdDefinitionSchema = z.enum(['Any Occ', 'Own Occ']);
export type TpdDefinition = z.infer<typeof tpdDefinitionSchema>;

export const coverTypeSchema = z.enum(['Life', 'TPD', 'Trauma', 'IP']);
export type CoverType = z.infer<typeof coverTypeSchema>;

/**
 * Risk-profile band labels are the SAME five-label vocabulary as the
 * Fact Find. Re-exported (rather than duplicated) so the SOA Wizard
 * can mirror `risk_profile.riskProfile` straight across without a
 * lookup table.
 */
export {
  riskProfileBandSchema,
  type RiskProfileBand,
} from '../factFind/riskProfile.js';

/**
 * Discriminator used by the projection engine + chart renderer; the
 * SOA's `projections` section persists exactly the two scenarios it
 * compared (REBUILD_PLAN §19.1.11).
 */
export const projectionScenarioSchema = z.enum(['baseline', 'recommended']);
export type ProjectionScenario = z.infer<typeof projectionScenarioSchema>;

export const superRecommendationActionSchema = z.enum([
  'Retain current',
  'Consolidate',
  'Switch',
  'Open new',
]);
export type SuperRecommendationAction = z.infer<typeof superRecommendationActionSchema>;

export const investmentRecommendationActionSchema = z.enum([
  'No action',
  'Open',
  'Switch',
  'Top up',
]);
export type InvestmentRecommendationAction = z.infer<typeof investmentRecommendationActionSchema>;
