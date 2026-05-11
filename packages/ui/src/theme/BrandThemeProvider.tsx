import { useMemo, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { deriveBrandPalette, type BrandBundle } from '@advicelink/branding';

export interface BrandThemeProviderProps {
  brand: BrandBundle;
  children: ReactNode;
}

/**
 * Resolves a tenant brand bundle into CSS variables on a wrapping div, so
 * every Tailwind utility and every semantic component picks up the tenant's
 * primary/accent palette automatically.
 *
 * Per REBUILD_PLAN §10.7 + §11.6.5, tenants supply only `primary` and
 * `accent`; the hover/pressed/contrast variants are derived deterministically
 * by `deriveBrandPalette`.
 */
export function BrandThemeProvider({ brand, children }: BrandThemeProviderProps): ReactElement {
  const cssVars = useMemo<CSSProperties>(() => {
    const primary = deriveBrandPalette(brand.colours.primary);
    const accent = deriveBrandPalette(brand.colours.accent);

    return {
      '--ui-color-brand-primary': primary.base,
      '--ui-color-brand-primary-hover': primary.hover,
      '--ui-color-brand-primary-pressed': primary.pressed,
      '--ui-color-brand-primary-contrast': primary.onBrand,
      '--ui-color-brand-primary-subtle': primary.subtle,
      '--ui-color-brand-row-selection': primary.rowSelection,

      '--ui-color-brand-accent': accent.base,
      '--ui-color-brand-accent-hover': accent.hover,
      '--ui-color-brand-accent-pressed': accent.pressed,
      '--ui-color-brand-accent-contrast': accent.onBrand,

      '--ui-font-family-sans': brand.typography.bodyFont,
      '--ui-font-family-display': brand.typography.headingFont,
    } as CSSProperties;
  }, [brand]);

  return (
    <div data-brand-theme style={cssVars}>
      {children}
    </div>
  );
}
