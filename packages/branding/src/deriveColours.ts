import { converter, formatHex, parse } from 'culori';

import type { DerivedColourScale } from './types.js';

const toOklch = converter('oklch');
const toRgb = converter('rgb');

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * Perceived luminance of a hex colour in [0, 1] using sRGB relative luminance
 * (WCAG 2.x formula). Used to choose contrast colour for text on a brand fill.
 */
function relativeLuminance(hex: string): number {
  const rgb = toRgb(parse(hex));
  if (!rgb) return 0;

  const channel = (c: number): number => {
    const v = clamp01(c);
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/**
 * Derive the full Advicelink brand palette from a single hex input.
 * See REBUILD_PLAN.md §19.15 — uses OKLCH lightness/chroma shifts so the
 * derivations are perceptually uniform regardless of input hue.
 */
export function deriveBrandPalette(brandHex: string): DerivedColourScale {
  const base = toOklch(parse(brandHex));
  if (!base) {
    throw new Error(`@advicelink/branding: invalid brand colour ${brandHex}`);
  }

  const shift = (lDelta: number, cDelta = 0): string => {
    const colour = formatHex({
      mode: 'oklch',
      l: clamp01(base.l + lDelta),
      c: Math.max(0, base.c + cDelta),
      h: base.h ?? 0,
    });
    if (!colour) {
      throw new Error(`@advicelink/branding: failed to format derived colour`);
    }
    return colour;
  };

  const baseHex = formatHex(base);
  if (!baseHex) {
    throw new Error(`@advicelink/branding: failed to format base colour`);
  }

  const contrastFor = (bg: string): string =>
    relativeLuminance(bg) > 0.55 ? '#0F172A' : '#FFFFFF';

  return {
    base: baseHex,
    hover: shift(-0.04),
    pressed: shift(-0.08),
    subtle: shift(+0.32, -0.08),
    rowSelection: shift(+0.36, -0.1),
    onBrand: contrastFor(baseHex),
  };
}
