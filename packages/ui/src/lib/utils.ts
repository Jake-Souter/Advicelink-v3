import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Canonical class merger used by every shadcn-derived primitive in
 * `packages/ui/src/components/ui/`. Combines `clsx` (conditional class
 * composition) with `tailwind-merge` (deduplication of conflicting
 * Tailwind utilities).
 *
 * Defined inside `packages/ui` per the design-system rule: shadcn's
 * default `@/lib/utils` alias points at this file, so generated
 * components import it without escaping the UI package layer.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
