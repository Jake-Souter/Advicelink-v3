/**
 * Tailwind preset emitted from the token sources of truth.
 *
 * Apps consume this via `presets: [tokenPreset]` in `tailwind.config.ts`.
 * Brand colours flow through CSS variables so they re-theme per tenant
 * (see `BrandThemeProvider`).
 */
import type { Config } from 'tailwindcss';

import { colors } from './colors.js';
import { space, size } from './space.js';
import { typography } from './typography.js';
import { radius, shadow } from './effects.js';

const tailwindPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: colors.brand.primary,
          hover: colors.brand.primaryHover,
          pressed: colors.brand.primaryPressed,
          contrast: colors.brand.primaryContrast,
          accent: colors.brand.accent,
          accentHover: colors.brand.accentHover,
          accentPressed: colors.brand.accentPressed,
          accentContrast: colors.brand.accentContrast,
        },
        surface: colors.surface,
        border: colors.border,
        text: colors.text,
        state: colors.state,
        selection: colors.selection,
      },
      spacing: space,
      width: { sidebar: size.sidebar.width, card: size.card.maxWidth },
      height: { navItem: size.navItem.height, tableRow: size.table.rowHeight },
      fontFamily: {
        sans: [typography.fontFamily.sans],
        display: [typography.fontFamily.display],
        mono: [typography.fontFamily.mono],
      },
      fontSize: typography.fontSize,
      // Tailwind expects string KV maps for these even though our token
      // taxonomy keeps them as numbers for ergonomic JS access.
      fontWeight: Object.fromEntries(
        Object.entries(typography.fontWeight).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      lineHeight: Object.fromEntries(
        Object.entries(typography.lineHeight).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
      borderRadius: radius,
      boxShadow: shadow,
    },
  },
};

export default tailwindPreset;
