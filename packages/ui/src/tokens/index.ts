export { colors } from './colors.js';
export { space, size } from './space.js';
export { typography } from './typography.js';
export { radius, shadow, motion, zIndex } from './effects.js';

import { colors } from './colors.js';
import { space, size } from './space.js';
import { typography } from './typography.js';
import { radius, shadow, motion, zIndex } from './effects.js';

/**
 * Single object form for ergonomic access in semantic components:
 *
 *   import { tokens } from '@advicelink/ui/tokens';
 *   tokens.color.brand.primary
 */
export const tokens = {
  color: colors,
  space,
  size,
  typography,
  radius,
  shadow,
  motion,
  zIndex,
} as const;

export type Tokens = typeof tokens;
