import { useMemo, type ReactElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { trpc, createTrpcClient } from '../../lib/trpc';
import { AuthProvider } from './AuthProvider';

/**
 * Top-level providers shared by every route. The `tenantSlug` (if
 * known) determines the tRPC URL prefix; routes outside any tenant
 * (the bare `/`) pass `null` and only public, no-tenant procedures
 * remain callable.
 *
 * The query client is intentionally created inside the component so
 * tests can mount a fresh provider tree without leaking state across
 * suites; the `useMemo` makes it stable for production renders.
 */
export interface AppProvidersProps {
  tenantSlug: string | null;
  children: ReactNode;
}

export function AppProviders({ tenantSlug, children }: AppProvidersProps): ReactElement {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Per REBUILD_PLAN §19.21.4 — only retry network/5xx; the
            // tRPC layer's per-query overrides handle 4xx semantics.
            retry: 2,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Mutations must NEVER auto-retry — risks duplicate writes
            // on transient blips. Idempotency is feature-by-feature.
            retry: false,
          },
        },
      }),
    [],
  );

  // No tenant in the URL: only the no-tenant `/trpc` mount is reachable.
  // We still build a client so health probes and discovery flows work.
  const trpcClient = useMemo(
    () => createTrpcClient({ tenantSlug: tenantSlug ?? '_no_tenant' }),
    [tenantSlug],
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
