import { Link, useRouterState } from '@tanstack/react-router';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { Home, LayoutDashboard, Users, type LucideIcon } from 'lucide-react';

import {
  AppShell as SemanticAppShell,
  Breadcrumbs,
  type AppShellLinkComponent,
  type AppShellNavGroup,
  type AppShellNavItem,
  type BreadcrumbItemData,
} from '@advicelink/ui';
import type { Role } from '@advicelink/rbac';

import { trpc } from '../../lib/trpc';
import { useAuth } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';

/**
 * Application shell adapter for the web app. Wires the router-aware
 * pieces (TanStack Router `<Link>`, `useRouterState`, signed-in user,
 * resolved tenant) into the router-agnostic `<AppShell>` semantic
 * surface in `@advicelink/ui` (Layer 4 over the shadcn `sidebar-08`
 * atoms — see `.cursor/rules/design-system.mdc`).
 *
 * `extraNavGroups` lets feature pages (e.g. Fact Find) inject a
 * page-specific nav block under the standard top-level entries.
 * `breadcrumbs` mirrors the shadcn breadcrumb structure as data; the
 * adapter wraps them with the TanStack `Link` so SPA navigation works
 * without each route re-implementing its own breadcrumb component.
 */

interface NavLinkProps {
  to: string;
  className?: string;
  children?: ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

const RouterLink: AppShellLinkComponent = ({ to, children, ...rest }: NavLinkProps) => (
  <Link to={to} {...rest}>
    {children}
  </Link>
);

export interface AppShellProps {
  tenantSlug: string;
  /**
   * Optional extra nav groups appended after the standard primary nav.
   * Use for page-specific sub-navigation (e.g. the Fact Find sections).
   */
  extraNavGroups?: readonly AppShellNavGroup[];
  /**
   * Breadcrumbs rendered in the topbar. Omit (or pass an empty array)
   * to suppress the breadcrumb trail.
   */
  breadcrumbs?: readonly BreadcrumbItemData[];
  children: ReactNode;
}

export function AppShell({
  tenantSlug,
  extraNavGroups,
  breadcrumbs,
  children,
}: AppShellProps): ReactElement {
  const tenant = useTenant();
  const { user, signOut } = useAuth();
  const whoami = trpc.auth.whoami.useQuery();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const primaryNav: AppShellNavGroup = useMemo(() => {
    const role = whoami.data?.user.role as Role | undefined;
    const portalEntry = portalNavItemForRole(tenantSlug, role);
    const items: AppShellNavItem[] = [
      {
        id: 'home',
        label: 'Home',
        to: `/t/${tenantSlug}/home`,
        icon: Home,
        isActive: pathname === `/t/${tenantSlug}/home`,
      },
      ...(portalEntry
        ? [
            {
              ...portalEntry,
              isActive: pathname === portalEntry.to || pathname.startsWith(`${portalEntry.to}/`),
            },
          ]
        : []),
      {
        id: 'clients',
        label: 'Clients',
        to: `/t/${tenantSlug}/clients`,
        icon: Users,
        isActive: pathname.startsWith(`/t/${tenantSlug}/clients`),
      },
    ];
    return { id: 'primary', label: 'Workspace', items };
  }, [pathname, tenantSlug, whoami.data?.user.role]);

  const navGroups = useMemo<readonly AppShellNavGroup[]>(
    () => [primaryNav, ...(extraNavGroups ?? [])],
    [primaryNav, extraNavGroups],
  );

  const userName = user?.displayName ?? user?.email ?? 'User';
  const userEmail = user?.email ?? '';
  const userAvatar = user?.photoURL ?? undefined;

  return (
    <SemanticAppShell
      brand={{
        name: tenant.displayName,
        tagline: tenant.slug,
        to: `/t/${tenantSlug}/home`,
      }}
      nav={navGroups}
      user={{ name: userName, email: userEmail, avatar: userAvatar }}
      linkComponent={RouterLink}
      onSignOut={() => {
        void signOut();
      }}
      breadcrumbs={
        breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumbs items={breadcrumbs} linkComponent={RouterLink} />
        ) : undefined
      }
    >
      {children}
    </SemanticAppShell>
  );
}

interface PortalEntry {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

function portalNavItemForRole(tenantSlug: string, role: Role | undefined): PortalEntry | null {
  switch (role) {
    case 'lead_gen':
      return {
        id: 'portal-lead-gen',
        label: 'Lead Gen portal',
        to: `/t/${tenantSlug}/portal/lead-gen`,
        icon: LayoutDashboard,
      };
    case 'adviser':
      return {
        id: 'portal-adviser',
        label: 'Adviser portal',
        to: `/t/${tenantSlug}/portal/adviser`,
        icon: LayoutDashboard,
      };
    case 'paraplanner':
      return {
        id: 'portal-paraplanner',
        label: 'Paraplanner portal',
        to: `/t/${tenantSlug}/portal/paraplanner`,
        icon: LayoutDashboard,
      };
    case 'uf_support':
      return {
        id: 'portal-uf-support',
        label: 'UF Support portal',
        to: `/t/${tenantSlug}/portal/uf-support`,
        icon: LayoutDashboard,
      };
    case 'ar_support':
      return {
        id: 'portal-ar-support',
        label: 'AR Support portal',
        to: `/t/${tenantSlug}/portal/ar-support`,
        icon: LayoutDashboard,
      };
    case 'ar_adviser':
      return {
        id: 'portal-ar-adviser',
        label: 'AR Adviser portal',
        to: `/t/${tenantSlug}/portal/ar-adviser`,
        icon: LayoutDashboard,
      };
    case 'management':
    case 'tenant_super_admin':
    case 'platform_super_admin':
      return {
        id: 'portal-adviser',
        label: 'Adviser portal',
        to: `/t/${tenantSlug}/portal/adviser`,
        icon: LayoutDashboard,
      };
    default:
      return null;
  }
}
