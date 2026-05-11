import { randomUUID } from 'node:crypto';

import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Logger } from 'pino';

import { dbClient, type Db } from '../db/index.js';

/**
 * Per-request context for every tRPC procedure. Populated minimally by
 * `createContext` here; `auth` middleware then attaches `user` + `tenant`
 * + `db` (the inside-RLS `Db` handle) once the Firebase token is
 * verified. Everything below `tenantSlug` is optional at this stage so
 * unauthenticated procedures (`health.ping`) still work.
 *
 * `dbClient` (the pool) is process-wide; `db` (the transaction-scoped
 * Drizzle handle wrapped by `withTenantContext`) is per-procedure and
 * lives only as long as the resolver's transaction.
 */
export interface BaseContext {
  reqId: string;
  logger: Logger;
  /** Tenant slug from the path prefix (`/t/:tenantSlug/trpc`). */
  tenantSlug: string | undefined;
  /** Raw bearer token, if any — verified by the `auth` middleware. */
  rawIdToken: string | undefined;
  /** The process-wide DB client / pool wrapper. */
  dbClient: typeof dbClient;
}

export type CreateContextDeps = {
  rootLogger: Logger;
};

const TENANT_PATH_RE = /^\/t\/([a-z0-9-]+)\//;

function extractTenantSlug(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  const match = TENANT_PATH_RE.exec(rawUrl);
  return match?.[1];
}

function extractBearer(authHeader: string | string[] | undefined): string | undefined {
  if (!authHeader) return undefined;
  const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1];
}

export function createContextFactory({ rootLogger }: CreateContextDeps) {
  return async function createContext({ req }: CreateFastifyContextOptions): Promise<BaseContext> {
    const reqId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    const tenantSlug = extractTenantSlug(req.raw.url);
    const rawIdToken = extractBearer(req.headers.authorization);

    const logger = rootLogger.child({
      reqId,
      tenantSlug: tenantSlug ?? null,
      // The user id is added inside the `auth` middleware once the JWT
      // is verified; logging it here would leak un-attributed traffic
      // into PII-heavy log lines.
    });

    return {
      reqId,
      logger,
      tenantSlug,
      rawIdToken,
      dbClient,
    };
  };
}

export type Context = BaseContext;

/** Helper to use `Db` inside resolver code without importing across packages. */
export type TxDb = Db;
