import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Layer-4 status badge. Wraps the shadcn `Badge` atom with a
 * domain-aware `tone` API so callers describe meaning ("in progress",
 * "complete", "blocked") rather than picking shadcn variants.
 *
 * Tones map to a fixed visual treatment so workflow chips stay
 * consistent across the clients list, portals, and Fact Find header.
 */

export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<StatusTone, string> = {
  /*
   * Tone classes intentionally bind to semantic shadcn tokens (already
   * present in `tokens.css`) instead of raw colours, so per-tenant
   * brand re-theming flows through the existing `<BrandThemeProvider>`
   * pipeline and the design-system "no raw hex" rule holds.
   */
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-primary/10 text-primary',
  progress: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'bg-destructive/10 text-destructive',
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}

export function StatusBadge({
  tone = 'neutral',
  className,
  children,
}: StatusBadgeProps): React.ReactElement {
  return (
    <Badge variant="secondary" className={cn(TONE_CLASSES[tone], className)} data-tone={tone}>
      {children}
    </Badge>
  );
}
