import type { BrandBundle } from '../types.js';

/**
 * Seed brand bundle for the launching tenant.
 *
 * Colours are sampled from `public/ready-advice-logo.png`:
 *   primary — deep navy used for the "READY ADVICE" wordmark and the R glyph
 *   accent  — teal of the chevron mark
 *
 * AFSL/licensee details, addresses, and document chrome image keys are
 * placeholders; replace these as the Ready Advice tenant onboarding runbook
 * progresses (REBUILD_PLAN §14.4 Phase 0).
 */
export const readyAdviceBrandBundle: BrandBundle = {
  logos: {
    light: { key: 'tenants/ready-advice/branding/logo-light.png' },
    dark: { key: 'tenants/ready-advice/branding/logo-dark.png' },
    mono: { key: 'tenants/ready-advice/branding/logo-mono.png' },
    favicon: { key: 'tenants/ready-advice/branding/favicon.ico' },
  },
  colours: {
    primary: '#0E2244',
    accent: '#2DD4BF',
  },
  typography: {
    bodyFont: 'Inter',
    headingFont: 'Inter',
  },
  documentChrome: {
    pageSize: 'A4',
  },
  licensee: {
    name: 'TBD — Ready Advice licensee',
    abn: 'TBD',
    afsl: 'TBD',
    address: {
      street: 'TBD',
      suburb: 'TBD',
      state: 'TBD',
      postcode: 'TBD',
      country: 'Australia',
    },
  },
  companyData: {
    name: 'Ready Advice',
    abn: 'TBD',
    address: {
      street: 'TBD',
      suburb: 'TBD',
      state: 'TBD',
      postcode: 'TBD',
      country: 'Australia',
    },
  },
};
