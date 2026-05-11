import { z } from 'zod';

/**
 * Strictly the env vars `@advicelink/db` itself reads (CLI scripts +
 * the test suite). App processes pass `databaseUrl` directly to
 * `createDbClient` so this loader is never invoked by them.
 *
 * Per `env-and-integrations` Cursor rule, this is the ONLY file in this
 * package allowed to touch `process.env` directly.
 *
 * Mirrors the public/internal preference in `apps/api/src/config/env.ts`:
 * Railway's `DATABASE_PUBLIC_URL` (TCP-proxy) is preferred from a laptop;
 * the deployed services rely on `DATABASE_URL` (private network).
 */
const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // Maps to postgres-js's `ssl` option. `false` disables TLS entirely
  // (the only sensible value for `localhost` testing), `prefer` opportunistic,
  // `require` mandatory. Railway's TCP-proxy supports `prefer`/`require`.
  DATABASE_SSL: z
    .enum(['false', 'prefer', 'require'])
    .optional()
    .default('prefer'),
  // Boot-admin overrides for `db:seed`. The seed inserts a single
  // `platform_super_admin` row so WP-3 (auth + tRPC) has something to log
  // into in dev. Set these to your real Firebase UID + email if you want
  // the seed to provision *your* account; otherwise documented placeholders
  // land and you rotate the row after first login.
  FIREBASE_BOOT_ADMIN_UID: z.string().min(1).optional(),
  FIREBASE_BOOT_ADMIN_EMAIL: z.string().email().optional(),
  FIREBASE_BOOT_ADMIN_DISPLAY_NAME: z.string().min(1).optional(),
});

const parsed = schema.safeParse({
  DATABASE_URL: databaseUrl,
  DATABASE_SSL: process.env.DATABASE_SSL,
  FIREBASE_BOOT_ADMIN_UID: process.env.FIREBASE_BOOT_ADMIN_UID,
  FIREBASE_BOOT_ADMIN_EMAIL: process.env.FIREBASE_BOOT_ADMIN_EMAIL,
  FIREBASE_BOOT_ADMIN_DISPLAY_NAME: process.env.FIREBASE_BOOT_ADMIN_DISPLAY_NAME,
});

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors;
  console.error('[@advicelink/db] env validation failed:\n' + JSON.stringify(fieldErrors, null, 2));
  const summary = Object.entries(fieldErrors)
    .map(([k, v]) => `${k}: ${(v ?? []).join(', ')}`)
    .join('; ');
  throw new Error(`@advicelink/db env validation failed — ${summary}`);
}

export const env = parsed.data;
