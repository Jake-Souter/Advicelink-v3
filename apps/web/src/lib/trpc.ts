import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query';
import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import superjson from 'superjson';

import type { AppRouter } from '@advicelink/api/trpc';

import { env } from '../config/env';
import { getFirebaseAuth } from './firebase';

/**
 * Typed tRPC React bindings — `trpc.health.ping.useQuery()`, etc.
 *
 * The actual concrete client is created per-tenant by `createTrpcClient`
 * because the URL prefix carries the tenant slug
 * (`/t/{tenantSlug}/trpc`). Public procedures live on the same root
 * router and simply skip the auth middleware, so a tenant-prefixed URL
 * is still correct for pre-auth calls like `tenants.publicLookup`.
 *
 * Mounting the router under both `/trpc` and `/t/:tenantSlug/trpc` on
 * the API side is what makes this safe.
 */
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

export type AppTrpcClient = TRPCClient<AppRouter>;

interface CreateTrpcClientOptions {
  /** Tenant slug as it appears in the URL. */
  tenantSlug: string;
  /** Optional overrides — primarily for tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Build a tRPC client bound to a specific tenant slug.
 *
 * The bearer token is fetched on every request from the live Firebase
 * Auth instance — never cached — so token rotation by Firebase happens
 * transparently and we never accidentally send a stale ID token after a
 * silent refresh.
 */
export function createTrpcClient({
  tenantSlug,
  fetchImpl,
}: CreateTrpcClientOptions): AppTrpcClient {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${env.VITE_API_BASE_URL}/t/${tenantSlug}/trpc`,
        transformer: superjson,
        async headers() {
          const auth = getFirebaseAuth();
          const user = auth.currentUser;
          if (!user) return {};
          // `false` => returns the cached token if still valid; Firebase
          // refreshes automatically a few minutes before expiry.
          const token = await user.getIdToken(false);
          return { Authorization: `Bearer ${token}` };
        },
        ...(fetchImpl ? { fetch: fetchImpl } : {}),
      }),
    ],
  });
}
