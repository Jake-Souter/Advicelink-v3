import type { SoaWizardSectionId } from '@advicelink/schemas';

/**
 * Display metadata for the SOA Wizard side nav. The canonical id list
 * lives in `@advicelink/schemas`; this file decorates it with
 * UI-facing labels and the lightweight grouping the wizard's
 * sub-nav uses (REBUILD_PLAN §6.12).
 *
 * Mirrors the Fact Find's `sectionMeta.ts` design choice: groups are
 * a presentation concern only — the section IDs themselves stay flat
 * so router params and the tRPC discriminator carry one stable
 * vocabulary.
 */

export interface SoaWizardSectionMeta {
  id: SoaWizardSectionId;
  label: string;
  description: string;
  group: 'Document setup' | 'Client snapshot' | 'Recommendations' | 'Money & numbers' | 'Sign-off';
  /** True while the bespoke editor for this section is still TODO and
   *  the wizard renders a generic JSON-shape placeholder so deep
   *  links don't 404. Removed once a real editor lands. */
  placeholder?: boolean;
}

export const SOA_WIZARD_SECTION_META: readonly SoaWizardSectionMeta[] = [
  {
    id: 'cover',
    label: 'Cover & Title',
    description: 'Title page, prepared-for/by, dates',
    group: 'Document setup',
  },
  {
    id: 'aboutAuthority',
    label: 'About Us & Authority',
    description: 'Scope of advice, basis, fees, authority statement',
    group: 'Document setup',
  },
  {
    id: 'goals',
    label: 'Your Goals',
    description: 'Prioritised goals + agreed review cadence',
    group: 'Client snapshot',
    placeholder: true,
  },
  {
    id: 'position',
    label: 'Your Current Position',
    description: 'Snapshot pulled from the locked Fact Find',
    group: 'Client snapshot',
    placeholder: true,
  },
  {
    id: 'riskProfile',
    label: 'Your Risk Profile',
    description: 'Recommended profile + rationale if overridden',
    group: 'Client snapshot',
    placeholder: true,
  },
  {
    id: 'strategyRecommendations',
    label: 'Strategy Recommendations',
    description: 'Per-theme rationale + benefits + considerations',
    group: 'Recommendations',
    placeholder: true,
  },
  {
    id: 'insuranceRecommendations',
    label: 'Insurance Recommendations',
    description: 'Per-cover gap analysis, structure, provider',
    group: 'Recommendations',
    placeholder: true,
  },
  {
    id: 'superRecommendations',
    label: 'Super Recommendations',
    description: 'Retain / consolidate / switch + contribution strategy',
    group: 'Recommendations',
    placeholder: true,
  },
  {
    id: 'investmentRecommendations',
    label: 'Investment Recommendations',
    description: 'Outside-super investment recommendation',
    group: 'Recommendations',
    placeholder: true,
  },
  {
    id: 'cashflowModelling',
    label: 'Cashflow Modelling',
    description: 'Surplus before/after + budget adjustments',
    group: 'Money & numbers',
    placeholder: true,
  },
  {
    id: 'projections',
    label: 'Projections',
    description: 'Pinned projection run + summary',
    group: 'Money & numbers',
    placeholder: true,
  },
  {
    id: 'feesCosts',
    label: 'Fees & Costs',
    description: 'Initial / ongoing / implementation + product fees',
    group: 'Money & numbers',
    placeholder: true,
  },
  {
    id: 'implementationPlan',
    label: 'Implementation Plan',
    description: 'Step list with owners + estimated timelines',
    group: 'Sign-off',
    placeholder: true,
  },
  {
    id: 'authorityToProceed',
    label: 'Authority to Proceed',
    description: 'Consents + signatures + payment authorities',
    group: 'Sign-off',
    placeholder: true,
  },
  {
    id: 'appendices',
    label: 'Appendices',
    description: 'Attached documents + glossary',
    group: 'Sign-off',
    placeholder: true,
  },
];

export const SOA_WIZARD_SECTION_GROUPS = [
  'Document setup',
  'Client snapshot',
  'Recommendations',
  'Money & numbers',
  'Sign-off',
] as const;
