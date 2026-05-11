import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button as ShadcnButton, type buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Layer-4 button. Wraps shadcn's `Button` atom behind a tone-based API
 * so callers describe intent (`primary`/`secondary`/`ghost`/`danger`/
 * `link`) rather than picking shadcn variants. Icons are passed as
 * lucide components and rendered with the canonical `data-icon` slot
 * (per the shadcn skill rule on icon sizing inside buttons).
 */

export type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'link';

const TONE_TO_VARIANT: Record<
  ButtonTone,
  NonNullable<VariantProps<typeof buttonVariants>['variant']>
> = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  outline: 'outline',
  link: 'link',
};

export interface ButtonProps extends Omit<React.ComponentProps<typeof ShadcnButton>, 'variant'> {
  tone?: ButtonTone;
  /** Optional icon shown before the label. */
  iconStart?: LucideIcon;
  /** Optional icon shown after the label. */
  iconEnd?: LucideIcon;
}

export function Button({
  tone = 'primary',
  iconStart: IconStart,
  iconEnd: IconEnd,
  className,
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  return (
    <ShadcnButton variant={TONE_TO_VARIANT[tone]} className={cn(className)} {...rest}>
      {IconStart ? <IconStart data-icon="inline-start" /> : null}
      {children}
      {IconEnd ? <IconEnd data-icon="inline-end" /> : null}
    </ShadcnButton>
  );
}
