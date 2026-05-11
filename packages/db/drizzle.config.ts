import { defineConfig } from 'drizzle-kit';

/**
 * `drizzle-kit` is used in this repo only for ergonomic dev tooling
 * (`pnpm db:studio` and `pnpm db:check` for snapshot diffs). Migrations
 * are hand-authored SQL in `./migrations` and applied by
 * `src/cli/migrate.ts`, NOT by `drizzle-kit migrate` — extensions, RLS,
 * triggers, and the GUC functions live well outside drizzle-kit's
 * generator surface.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url:
      process.env.DATABASE_PUBLIC_URL ??
      process.env.DATABASE_URL ??
      'postgres://placeholder/placeholder',
  },
  strict: true,
  verbose: true,
});
