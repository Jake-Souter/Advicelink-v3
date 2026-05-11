import * as React from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import type { AppShellLinkComponent } from './AppShell';

/**
 * Layer-4 semantic breadcrumbs that consume the shadcn `Breadcrumb*`
 * atoms. The last entry always renders as the current page (non-link);
 * earlier entries with a `to` render through the supplied
 * `linkComponent` (so callers wire TanStack Router or any other
 * router) and entries without a `to` render as plain text spans.
 */

export interface BreadcrumbItemData {
  id: string;
  label: React.ReactNode;
  to?: string;
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItemData[];
  linkComponent?: AppShellLinkComponent;
  className?: string;
}

const DefaultLink: AppShellLinkComponent = ({ to, children, ...rest }) => (
  <a href={to} {...rest}>
    {children}
  </a>
);

export function Breadcrumbs({
  items,
  linkComponent,
  className,
}: BreadcrumbsProps): React.ReactElement | null {
  if (items.length === 0) return null;
  const Link = linkComponent ?? DefaultLink;
  const lastIndex = items.length - 1;
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === lastIndex;
          return (
            <React.Fragment key={item.id}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : item.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{item.label}</span>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
