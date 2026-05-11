import type { FactFindSectionId } from '@advicelink/schemas';

/**
 * Display metadata for the Fact Find side nav. The canonical id list
 * lives in `@advicelink/schemas`; this file just decorates it with
 * UI-facing labels and a lightweight grouping for the nav.
 *
 * The 13 sections roughly map to the §11 spec but are flat in the
 * nav; grouping is a presentation choice only.
 */

export interface SectionMeta {
  id: FactFindSectionId;
  label: string;
  description: string;
  /** Group label rendered above the link in the nav. */
  group: 'About the client' | 'Money' | 'Recommendations';
}

export const SECTION_META: readonly SectionMeta[] = [
  {
    id: 'personal',
    label: 'Personal',
    description: 'Names, dates, addresses, contact, dependants',
    group: 'About the client',
  },
  {
    id: 'employment',
    label: 'Employment',
    description: 'Occupation, employer, leave accruals',
    group: 'About the client',
  },
  {
    id: 'partnerEmployment',
    label: 'Partner employment',
    description: 'Partner occupation and employer',
    group: 'About the client',
  },
  {
    id: 'financial',
    label: 'Income',
    description: 'Salary, business income, super guarantee',
    group: 'Money',
  },
  {
    id: 'assets',
    label: 'Assets',
    description: 'Property, savings, investments',
    group: 'Money',
  },
  {
    id: 'liabilities',
    label: 'Liabilities',
    description: 'Loans, credit cards, debts',
    group: 'Money',
  },
  {
    id: 'superannuation',
    label: 'Superannuation',
    description: 'Current super funds',
    group: 'Money',
  },
  {
    id: 'contributions',
    label: 'Contributions',
    description: 'SG, salary sacrifice, personal contributions',
    group: 'Money',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    description: 'Life, TPD, IP, trauma covers',
    group: 'Money',
  },
  {
    id: 'beneficiaries',
    label: 'Beneficiaries',
    description: 'Binding nominations across funds and policies',
    group: 'Money',
  },
  {
    id: 'goals',
    label: 'Goals',
    description: 'Short and long term goals + AI assist',
    group: 'Recommendations',
  },
  {
    id: 'riskProfile',
    label: 'Risk profile',
    description: 'Six-question risk profile + scoring band',
    group: 'Recommendations',
  },
  {
    id: 'recommendations',
    label: 'Recommendations',
    description: 'High-level recommendation summary',
    group: 'Recommendations',
  },
];

export const SECTION_GROUPS = ['About the client', 'Money', 'Recommendations'] as const;
