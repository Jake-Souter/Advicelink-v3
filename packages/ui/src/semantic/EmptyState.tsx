import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

/**
 * Layer-4 empty state. Wraps the shadcn `Empty*` atoms behind a flat
 * prop API so feature pages can declare an empty state in one line:
 *
 *   <EmptyState
 *     icon={Users}
 *     title="No clients yet"
 *     description="Create your first client to start a Fact Find."
 *     action={<Button>New client</Button>}
 *   />
 */

export interface EmptyStateProps {
  /** Optional lucide icon rendered inside an `EmptyMedia variant="icon"` slot. */
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary action — typically a `<Button>`. */
  action?: React.ReactNode;
  /** Optional dashed-outline treatment per the shadcn Empty "Outline" example. */
  variant?: 'default' | 'outline';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <Empty
      className={[variant === 'outline' ? 'border border-dashed' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description != null ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action != null ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
