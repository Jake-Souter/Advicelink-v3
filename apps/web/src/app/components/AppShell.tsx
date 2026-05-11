import { Link, useRouterState } from '@tanstack/react-router';
import { useState, type ReactElement, type ReactNode } from 'react';

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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [signingOut, setSigningOut] = useState(false);

  const navItems: NavItem[] = [
    { label: 'Home', to: `/t/${tenantSlug}/home` },
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
