/**
 * `@advicelink/db` public surface — Drizzle schema, typed client factory,
 * and the RLS-context helpers (`withTenantContext`, `withPlatformAdmin`).
 *
 * Migrations and the seed script live under `src/cli/` and are invoked via
 * `pnpm db:migrate` / `pnpm db:seed`; they are deliberately NOT exported
 * because feature code must never run them at runtime.
 *
 * REBUILD_PLAN refs: §7 (data model), §11.1 (package layout), §12.2 (RLS),
 * §19.16 (encryption / GUC plumbing).
 */
export * from './schema/index.js';
export {
  createDbClient,
  withTenantContext,
  withPlatformAdmin,
  type Db,
  type DbClient,
  type Schema,
  type TenantContext,
  type CreateDbClientOptions,
} from './client.js';
