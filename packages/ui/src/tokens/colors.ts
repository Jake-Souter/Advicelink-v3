/**
 * Static colour tokens. Brand colours are CSS variables (`--ui-color-brand-*`)
 * resolved at runtime by `<BrandThemeProvider>` so they re-theme per tenant.
 *
 * See REBUILD_PLAN.md §11.6.2 token taxonomy.
 */
export const colors = {
  brand: {
    primary: 'var(--ui-color-brand-primary)',
    primaryHover: 'var(--ui-color-brand-primary-hover)',
    primaryPressed: 'var(--ui-color-brand-primary-pressed)',
    primaryContrast: 'var(--ui-color-brand-primary-contrast)',
    accent: 'var(--ui-color-brand-accent)',
    accentHover: 'var(--ui-color-brand-accent-hover)',
    accentPressed: 'var(--ui-color-brand-accent-pressed)',
    accentContrast: 'var(--ui-color-brand-accent-contrast)',
  },
  surface: {
    base: '#F7F8FA',
    raised: '#FFFFFF',
    sunken: '#F2F4F7',
    inverse: '#0F172A',
  },
  border: {
    subtle: '#E5E7EB',
    strong: '#D0D5DD',
    focus: 'var(--ui-color-brand-primary)',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475467',
    tertiary: '#98A2B3',
    onBrand: 'var(--ui-color-brand-primary-contrast)',
    inverse: '#FFFFFF',
  },
  state: {
    success: '#16A34A',
    successSurface: '#DCFCE7',
    warning: '#D97706',
    warningSurface: '#FEF3C7',
    danger: '#DC2626',
    dangerSurface: '#FEE2E2',
    info: '#0284C7',
    infoSurface: '#E0F2FE',
  },
  selection: {
    rowBackground: 'var(--ui-color-brand-row-selection)',
    rowBorder: 'var(--ui-color-brand-primary)',
  },
} as const;
