/**
 * Zod schemas for every entity, DTO, and wizard section.
 *
 * Per REBUILD_PLAN §17, every feature ships its Zod schema here
 * before the tRPC procedure or frontend form references it. The
 * frontend imports inferred types via the tRPC client; never
 * duplicate a shape.
 *
 * Current scope:
 *   - factFind/*   — 10 Fact Find section schemas + server-side
 *                    derivation helpers (WP-6.2)
 *   - soaWizard/*  — 15 SOA Wizard section schemas (WP-8); shared
 *                    primitives borrow from factFind/primitives so
 *                    money / frequency / percentages stay aligned.
 *
 * The two namespaces are also re-exported as flat names so existing
 * imports from `@advicelink/schemas` keep working. When a name
 * collision arises (`goalsSchema`, `riskProfileSchema`, …) prefer
 * the namespaced form (`schemas.factFind.goalsSchema` /
 * `schemas.soaWizard.goalsSchema`).
 */
export * as factFind from './factFind/index.js';
export * as soaWizard from './soaWizard/index.js';
export * from './factFind/index.js';
// SOA Wizard section names re-exported with a `SoaWizard` suffix on
// the colliding identifiers (see `soaWizard/index.ts` for the full
// list); raw primitives are accessed via the `soaWizard.*` namespace.
export {
  SOA_WIZARD_SECTION_IDS,
  soaWizardSectionDefaults,
  soaWizardSectionSchemas,
  type SoaWizardSectionId,
} from './soaWizard/index.js';
