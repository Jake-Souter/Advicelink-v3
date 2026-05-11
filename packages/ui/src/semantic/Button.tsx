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
  asChild,
  className,
  children,
  ...rest
}: ButtonProps): React.ReactElement {
  const startIcon = IconStart ? <IconStart data-icon="inline-start" /> : null;
  const endIcon = IconEnd ? <IconEnd data-icon="inline-end" /> : null;

  /*
   * `asChild` makes the underlying shadcn `Button` render a Radix `Slot`,
   * which strictly requires a single React element child (it forwards
   * props onto that element). If we passed `[startIcon, children, endIcon]`
   * directly, `Slot.SlotClone` throws `React.Children.only`. Instead,
   * splice the icons INSIDE the cloned child so the slot still sees one
   * element while the rendered DOM ends up `<a><Icon/>label<Icon/></a>`.
   */
  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    const decorated = React.cloneElement(
      child,
      undefined,
      startIcon,
      child.props.children,
      endIcon,
    );
    return (
      <ShadcnButton asChild variant={TONE_TO_VARIANT[tone]} className={cn(className)} {...rest}>
        {decorated}
      </ShadcnButton>
    );
  }

  return (
    <ShadcnButton variant={TONE_TO_VARIANT[tone]} className={cn(className)} {...rest}>
      {startIcon}
      {children}
      {endIcon}
    </ShadcnButton>
  );
}
