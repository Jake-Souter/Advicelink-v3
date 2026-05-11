import { createFileRoute } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';

import { Stack } from '@advicelink/ui';

import { useAuth } from '../providers/AuthProvider';
import { useTenant } from '../providers/TenantProvider';
import { trpc } from '../../lib/trpc';

/**
 * Placeholder authed home page — proves end-to-end that the Firebase
 * token, tRPC client, and tenant-scoped backend resolver all line up.
 *
 * Real role-based portals (lead-gen, adviser, paraplanner …) land in
 * WP-7 onwards (REBUILD_PLAN §4.5).
 */
export const Route = createFileRoute('/t/$tenantSlug/_authed/home')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const tenant = useTenant();
  const { user, signOut } = useAuth();
  const whoami = trpc.auth.whoami.useQuery();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <main data-page="home">
      <Stack gap={4} align="center">
        <h1>Welcome to {tenant.displayName}</h1>
        <p>
          Signed in as <strong>{user?.email}</strong>
        </p>
        {whoami.isPending ? <p>Loading session…</p> : null}
        {whoami.isError ? <p role="alert">Could not load session: {whoami.error.message}</p> : null}
        {whoami.data ? (
          <Stack gap={2} align="center">
            <p>
              Role: <code>{whoami.data.user.role}</code>
            </p>
            <p>
              Tenant: <code>{whoami.data.tenant.slug}</code> ({whoami.data.tenant.displayName})
            </p>
          </Stack>
        ) : null}
        <button
          type="button"
          data-button="secondary"
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
      </Stack>
    </main>
  );
}
