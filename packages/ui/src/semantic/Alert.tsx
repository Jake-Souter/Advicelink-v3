import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from 'lucide-react';

import { Alert as ShadcnAlert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

/**
 * Layer-4 alert. Wraps the shadcn `Alert` atom with a tone-based API
 * mirroring the legacy `[data-banner]` palette (info / success /
 * warning / danger / neutral) so feature pages can describe intent
 * rather than juggling shadcn variants + custom classes.
 *
 * The icon defaults to a tone-appropriate lucide glyph; pass `icon={null}`
 * to suppress, or override with a different icon.
 */

export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_ICONS: Record<AlertTone, LucideIcon | null> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
  neutral: null,
};

const TONE_CLASSES: Record<AlertTone, string> = {
  info: 'border-primary/20 bg-primary/5 text-primary [&>svg]:text-primary',
  success:
    'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 [&>svg]:text-emerald-500',
  warning:
    'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 [&>svg]:text-amber-500',
  danger: '', // shadcn's `destructive` variant already covers this.
  neutral: '',
};

export interface AlertProps {
  tone?: AlertTone;
  title?: React.ReactNode;
  /**
   * Override the default tone icon. Pass `null` to suppress entirely
   * (useful when the alert is purely textual).
   */
  icon?: LucideIcon | null;
  className?: string;
  children?: React.ReactNode;
}

export function Alert({
  tone = 'info',
  title,
  icon,
  className,
  children,
}: AlertProps): React.ReactElement {
  const Icon = icon === null ? null : (icon ?? TONE_ICONS[tone]);
  return (
    <ShadcnAlert
      variant={tone === 'danger' ? 'destructive' : 'default'}
      className={cn(tone !== 'danger' ? TONE_CLASSES[tone] : undefined, className)}
      data-tone={tone}
    >
      {Icon ? <Icon /> : null}
      {title != null ? <AlertTitle>{title}</AlertTitle> : null}
      {children != null ? <AlertDescription>{children}</AlertDescription> : null}
    </ShadcnAlert>
  );
}
