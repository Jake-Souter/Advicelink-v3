import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import * as schema from './schema/index.js';
import type { UserRole } from './schema/enums.js';

export type Schema = typeof schema;
export type Db = PostgresJsDatabase<Schema>;
export type DbClient = {
  sql: Sql;
  db: Db;
  /** Optional master key for the per-tenant TFN encryption helpers. */
  tfnMasterKey?: string;
};

export interface CreateDbClientOptions {
  /** TCP pool size. App processes use 10; CLIs use 1. */
  max?: number;
  /** Postgres SSL mode. `false` disables, `'prefer'` opportunistic, `'require'` mandatory. */
  ssl?: false | 'prefer' | 'require';
  /** Override `application_name` for Railway query metrics. */
  applicationName?: string;
  /** Connection timeout (seconds). */
  connectTimeout?: number;
  /** Idle timeout (seconds). */
  idleTimeout?: number;
  /**
   * Master key for `pgcrypto`-based TFN encryption (REBUILD_PLAN §7.8 /
   * §19.16). When provided, every transaction opened via
   * `withTenantContext` / `withPlatformAdmin` sets the
   * `app.tfn_master_key` GUC so the `app_encrypt_tfn` /
   * `app_decrypt_tfn` SQL helpers can derive the per-tenant key. Omit
   * to disable encryption support — any call into the helpers will
   * then throw, which is the right failure mode for non-prod tooling.
   */
  tfnMasterKey?: string;
}

/**
 * Create a postgres-js pool + Drizzle wrapper. Callers MUST keep a single
 * client per process and pass it down — opening a new pool per request is
 * a connection-leak in waiting.
 *
 * Returns `{ sql, db }`:
 *  - `sql` is the raw postgres-js client; reach for it for `LISTEN/NOTIFY`,
 *    `COPY`, or one-off DDL during scripts.
 *  - `db` is the type-safe Drizzle wrapper used by feature services.
 */
export function createDbClient(databaseUrl: string, options: CreateDbClientOptions = {}): DbClient {
  const sqlClient = postgres(databaseUrl, {
    max: options.max ?? 10,
    ssl: options.ssl ?? 'prefer',
    idle_timeout: options.idleTimeout ?? 30,
    connect_timeout: options.connectTimeout ?? 10,
    connection: {
      application_name: options.applicationName ?? 'advicelink',
    },
    prepare: false,
    transform: { undefined: null },
  });
  const db = drizzle(sqlClient, { schema, logger: false });
  return { sql: sqlClient, db, tfnMasterKey: options.tfnMasterKey };
}

/** Identity payload set as Postgres GUCs for the lifetime of one transaction. */
export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: UserRole;
}

/**
 * Run `fn` inside a transaction with the three RLS GUCs set:
 *  - `app.current_tenant_id`
 *  - `app.current_user_id`
 *  - `app.current_user_role`
 *
 * `set_config(..., true)` makes the values transaction-local so the next
 * checked-out connection from the pool starts clean — critical because
 * Postgres pools are recycled across requests.
 *
 * `SET LOCAL ROLE app_user` is the linchpin: Railway's connecting role
 * is `postgres` (a superuser, which BYPASSES RLS). Switching into the
 * non-superuser `app_user` for the lifetime of the transaction makes
 * every policy actually fire. The role is reset automatically when the
 * transaction commits or rolls back.
 *
 * EVERY tRPC procedure that touches the database MUST go through this
 * helper. Direct `db.select()` calls without context will return zero
 * rows (RLS blocks) and fail loudly, which is the desired safety net.
 */
export async function withTenantContext<T>(
  client: DbClient,
  ctx: TenantContext,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  return client.db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${ctx.tenantId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`);
    await tx.execute(sql`SELECT set_config('app.current_user_role', ${ctx.userRole}, true)`);
    if (client.tfnMasterKey) {
      await tx.execute(sql`SELECT set_config('app.tfn_master_key', ${client.tfnMasterKey}, true)`);
    }
    return fn(tx);
  });
}

/**
 * Escape hatch for migrations, seed scripts, and the `audit-log` mirror
 * worker — assumes the `platform_super_admin` role and (optionally) a
 * tenant. Use ONLY from CLI tools and explicitly-authenticated
 * platform-admin routes; do not import this from feature services.
 *
 * Like `withTenantContext`, this also drops into `app_user` so RLS
 * policies fire — the `platform_super_admin` role is recognised by the
 * GUC reader, not by the database principal.
 */
export async function withPlatformAdmin<T>(
  client: DbClient,
  fn: (tx: Db) => Promise<T>,
  options: { tenantId?: string; userId?: string } = {},
): Promise<T> {
  return client.db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    if (options.tenantId) {
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${options.tenantId}, true)`);
    }
    if (options.userId) {
      await tx.execute(sql`SELECT set_config('app.current_user_id', ${options.userId}, true)`);
    }
    await tx.execute(sql`SELECT set_config('app.current_user_role', 'platform_super_admin', true)`);
    if (client.tfnMasterKey) {
      await tx.execute(sql`SELECT set_config('app.tfn_master_key', ${client.tfnMasterKey}, true)`);
    }
    return fn(tx);
  });
}
