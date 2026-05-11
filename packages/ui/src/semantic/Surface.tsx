import * as React from 'react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Layer-4 surface that wraps the shadcn `Card*` atoms. Pages compose
 * `<Surface>` instead of reaching for the underlying card primitives so
 * we can evolve the visual treatment (border, shadow, padding, motion)
 * in one place. Per the design-system rule, route/feature code never
 * imports the raw `Card*` atoms.
 *
 * Two layouts are supported: pass a `title` (and optional `description`/
 * `actions`/`footer`) to get a fully composed card, OR omit them and
 * just pass `children` to use `<Surface>` as a bare bordered panel.
 */

export interface SurfaceProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned action area in the header (typically a Button). */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Apply the standard card padding to the body. Defaults to true; set
   * false when the body owns its own edge-to-edge content (e.g. a
   * `<DataTable>` rendering its own padding).
   */
  padded?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function Surface({
  title,
  description,
  actions,
  footer,
  padded = true,
  className,
  bodyClassName,
  children,
}: SurfaceProps): React.ReactElement {
  const hasHeader = title != null || description != null || actions != null;
  return (
    <Card className={className}>
      {hasHeader ? (
        <CardHeader>
          {title != null ? <CardTitle>{title}</CardTitle> : null}
          {description != null ? <CardDescription>{description}</CardDescription> : null}
          {actions != null ? <CardAction>{actions}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(padded ? undefined : 'p-0', bodyClassName)}>
        {children}
      </CardContent>
      {footer != null ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
