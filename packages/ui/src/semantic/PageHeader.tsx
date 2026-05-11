import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Layer-4 page header. Renders a single-line heading with an optional
 * description and right-aligned actions cluster — no card chrome, no
 * background, no border. Pages compose this above their main content
 * (DataTable, form, portal kanban, etc.) so the page-title +
 * primary-action affordance is consistent without forcing every page
 * into a Card surface.
 *
 * Per the design-system rule, route/feature code never reaches for
 * Tailwind utilities directly; this wrapper owns all visual styling.
 */

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions cluster (typically one or more `<Button>`s). */
  actions?: React.ReactNode;
  /**
   * `'flush'` (default) leaves the header without bottom margin so the
   * surrounding `gap-*` spacing decides separation. `'separated'` adds
   * a thin bottom border + extra padding for pages where the header is
   * visually distinct from the body (e.g. detail pages with mixed
   * content sections).
   */
  variant?: 'flush' | 'separated';
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  variant = 'flush',
  className,
}: PageHeaderProps): React.ReactElement {
  return (
    <header
      data-slot="page-header"
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        variant === 'separated' ? 'border-border border-b pb-4' : undefined,
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description != null ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {actions != null ? (
        <div className="flex shrink-0 items-center gap-2 sm:self-center">{actions}</div>
      ) : null}
    </header>
  );
}
