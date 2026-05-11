import * as React from 'react';
import { ChevronRight, ChevronsUpDown, Command, LogOut, type LucideIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

/**
 * Layer-4 semantic application shell. Wraps the shadcn `sidebar-08`
 * primitives (Layer 2 atoms in `packages/ui/src/components/ui/`) into
 * a router-agnostic surface that feature pages render.
 *
 * Per the design-system rule, feature/route code (Layer 5/6) imports
 * THIS component, never the raw `Sidebar*` atoms. Routing concerns
 * are kept on the caller's side via the `linkComponent` prop, so this
 * file does not depend on TanStack Router (or any router).
 */

export type AppShellLinkProps = {
  to: string;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children?: React.ReactNode;
  'data-active'?: boolean | string;
};

export type AppShellLinkComponent = React.ComponentType<AppShellLinkProps>;

export interface AppShellNavSubItem {
  id: string;
  label: string;
  to: string;
  isActive?: boolean;
  /**
   * Override click navigation — when set the rendered anchor calls
   * `event.preventDefault()` then invokes this callback. Routers that
   * need richer navigation (e.g. TanStack `navigate({ search })` for
   * query-string-driven sub-routes like Fact Find sections) wire it
   * in. The `to` is still emitted as the anchor `href` so right-click
   * → "open in new tab" preserves deep-link behaviour.
   */
  onSelect?: () => void;
}

export interface AppShellNavItem {
  id: string;
  label: string;
  to: string;
  icon?: LucideIcon;
  isActive?: boolean;
  /** When provided the entry renders as a collapsible parent. */
  items?: readonly AppShellNavSubItem[];
  /** Force the collapsible open on first paint (defaults to `isActive`). */
  defaultOpen?: boolean;
  /** See `AppShellNavSubItem.onSelect`. */
  onSelect?: () => void;
}

export interface AppShellNavGroup {
  id: string;
  label?: string;
  items: readonly AppShellNavItem[];
}

export interface AppShellUser {
  name: string;
  email: string;
  avatar?: string;
}

export interface AppShellBrand {
  name: string;
  /** Short label rendered under the brand name (e.g. tenant slug or plan). */
  tagline?: string;
  /** Initials shown in the brand badge (defaults to first 2 chars of name). */
  initials?: string;
  /** Click target for the brand mark — defaults to `/`. */
  to?: string;
}

export interface AppShellProps {
  brand: AppShellBrand;
  nav: readonly AppShellNavGroup[];
  user?: AppShellUser;
  /** Anchor used for navigation. Defaults to a plain `<a>`. */
  linkComponent?: AppShellLinkComponent;
  /** Sign-out handler — when omitted the dropdown hides the menu item. */
  onSignOut?: () => void;
  /** Topbar slot — typically a `<Breadcrumbs />`. */
  breadcrumbs?: React.ReactNode;
  /** Topbar right-hand slot — typically actions or a tenant switcher. */
  topbarRight?: React.ReactNode;
  children: React.ReactNode;
}

const DefaultLink: AppShellLinkComponent = ({ to, children, ...rest }) => (
  <a href={to} {...rest}>
    {children}
  </a>
);

/**
 * Builds an `onClick` for nav anchors that lets callers intercept
 * navigation (e.g. to drive query-string-only sub-routes via TanStack
 * `navigate({ search })`). When `onSelect` is undefined the handler
 * returns `undefined` so the underlying router `<Link>` keeps its
 * default behaviour (and modifier-clicks still open new tabs).
 */
function makeSelectHandler(
  onSelect: (() => void) | undefined,
): React.MouseEventHandler<HTMLAnchorElement> | undefined {
  if (!onSelect) return undefined;
  return (event) => {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onSelect();
  };
}

function deriveInitials(name: string, override: string | undefined): string {
  if (override) return override.slice(0, 2).toUpperCase();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  return parts
    .slice(0, 2)
    .map((w) => w[0]!)
    .join('')
    .toUpperCase();
}

export function AppShell({
  brand,
  nav,
  user,
  linkComponent,
  onSignOut,
  breadcrumbs,
  topbarRight,
  children,
}: AppShellProps): React.ReactElement {
  const Link = linkComponent ?? DefaultLink;
  const initials = deriveInitials(brand.name, brand.initials);

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to={brand.to ?? '/'}>
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    {initials.length > 0 ? (
                      <span className="text-xs font-semibold">{initials}</span>
                    ) : (
                      <Command className="size-4" />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{brand.name}</span>
                    {brand.tagline ? (
                      <span className="truncate text-xs">{brand.tagline}</span>
                    ) : null}
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {nav.map((group) => (
            <SidebarGroup key={group.id}>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = (item.items?.length ?? 0) > 0;
                  if (hasChildren) {
                    return (
                      <Collapsible
                        key={item.id}
                        asChild
                        defaultOpen={item.defaultOpen ?? item.isActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.label} isActive={item.isActive}>
                              {Icon ? <Icon /> : null}
                              <span>{item.label}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.items!.map((sub) => (
                                <SidebarMenuSubItem key={sub.id}>
                                  <SidebarMenuSubButton asChild isActive={sub.isActive}>
                                    <Link to={sub.to} onClick={makeSelectHandler(sub.onSelect)}>
                                      <span>{sub.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton asChild tooltip={item.label} isActive={item.isActive}>
                        <Link to={item.to} onClick={makeSelectHandler(item.onSelect)}>
                          {Icon ? <Icon /> : null}
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          {user ? <UserMenu user={user} onSignOut={onSignOut} /> : null}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            {breadcrumbs ? (
              <>
                <Separator orientation="vertical" className="mr-2 h-4" />
                {breadcrumbs}
              </>
            ) : null}
          </div>
          {topbarRight ? <div className="flex items-center gap-2 px-3">{topbarRight}</div> : null}
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function UserMenu({
  user,
  onSignOut,
}: {
  user: AppShellUser;
  onSignOut?: () => void;
}): React.ReactElement {
  const { isMobile } = useSidebar();
  const fallback =
    (user.name || user.email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{fallback}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            {onSignOut ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => onSignOut()}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
