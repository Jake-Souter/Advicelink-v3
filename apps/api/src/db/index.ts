import { createDbClient, type DbClient } from '@advicelink/db';

import { env } from '../config/env.js';

/**
 * Process-wide DB client. Built once at module load — postgres-js owns
 * the underlying TCP pool and `createDbClient` is purely synchronous,
 * so first import is fine. Importers MUST NOT instantiate their own;
 * the workspace's RLS contract assumes one connection pool with the
 * `app_user` role-switching pattern wired through every transaction.
 */
export const dbClient: DbClient = createDbClient(env.DATABASE_URL, {
  max: env.NODE_ENV === 'production' ? 10 : 4,
  ssl: 'prefer',
  applicationName: env.OTEL_SERVICE_NAME,
});

/** Re-export the helpers so feature services can stay on a single import path. */
export {
  withTenantContext,
  withPlatformAdmin,
  type TenantContext,
  type Db,
} from '@advicelink/db';
