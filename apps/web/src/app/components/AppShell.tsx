import { Link, useRouterState } from '@tanstack/react-router';
import { useState, type ReactElement, type ReactNode } from 'react';

import type { Role } from '@advicelink/rbac';

import { trpc } from '../../lib/trpc';
import { useAuth } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';

/**
 * Shell layout for every authed page (clients list, fact-find,
 * later: SOA, AR, etc.). Sidebar nav + main content area + a
 * top bar that surfaces the signed-in user and a sign-out button.
 *
 * Nav links are filtered against the actor role per
 * REBUILD_PLAN §4.3 — only show the surfaces the role can use.
 *
 * The component reads `useRouterState` to highlight the active
 * link without a prop drill — TanStack Router's selector keeps the
 * subscription scoped to the path so we don't re-render the whole
 * shell on unrelated state changes.
 */

interface NavItem {
  label: string;
  to: string;
}

export interface AppShellProps {
  tenantSlug: string;
  children: ReactNode;
}

export function AppShell({ tenantSlug, children }: AppShellProps): ReactElement {
  const tenant = useTenant();
  const { user, signOut } = useAuth();
  const whoami = trpc.auth.whoami.useQuery();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);

  // Derive the role-specific portal link so the sidebar always
  // includes a one-click route back to the actor's primary surface.
  // Roles without a dedicated portal (legacy_import) fall back to
  // the clients list and the portal nav entry is suppressed.
  const portalEntry = portalNavItemForRole(tenantSlug, whoami.data?.user.role as Role | undefined);

  const navItems: NavItem[] = [
    { label: 'Home', to: `/t/${tenantSlug}/home` },
    ...(portalEntry ? [portalEntry] : []),
    { label: 'Clients', to: `/t/${tenantSlug}/clients` },
  ];

  return (
    <div data-page="app-shell">
      <aside data-app-sidebar>
        <header>
          <strong>{tenant.displayName}</strong>
        </header>
        <nav>
          <h2>Navigation</h2>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              data-active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main data-app-main>
        <header data-app-topbar>
          <div>{/* page title slot — supplied by child via h1 */}</div>
          <div>
            <span style={{ marginRight: '0.75rem' }}>{user?.email}</span>
            <button
              type="button"
              data-button="ghost"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().finally(() => {
                  setSigningOut(false);
                });
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function portalNavItemForRole(tenantSlug: string, role: Role | undefined): NavItem | null {
  switch (role) {
    case 'lead_gen':
      return { label: 'Lead Gen portal', to: `/t/${tenantSlug}/portal/lead-gen` };
    case 'adviser':
      return { label: 'Adviser portal', to: `/t/${tenantSlug}/portal/adviser` };
    case 'paraplanner':
      return { label: 'Paraplanner portal', to: `/t/${tenantSlug}/portal/paraplanner` };
    case 'uf_support':
      return { label: 'UF Support portal', to: `/t/${tenantSlug}/portal/uf-support` };
    case 'ar_support':
      return { label: 'AR Support portal', to: `/t/${tenantSlug}/portal/ar-support` };
    case 'ar_adviser':
      return { label: 'AR Adviser portal', to: `/t/${tenantSlug}/portal/ar-adviser` };
    case 'management':
    case 'tenant_super_admin':
    case 'platform_super_admin':
      return { label: 'Adviser portal', to: `/t/${tenantSlug}/portal/adviser` };
    default:
      return null;
  }
}
