/**
 * Build-time env loader for `apps/web` (Vite). Per REBUILD_PLAN §11.5 and
 * §19.19.3, only `VITE_*` vars are exposed to the browser bundle.
 *
 * No `process.env` access here — Vite injects vars via `import.meta.env`.
 */
import { z } from 'zod';

const schema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),
  VITE_POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
  VITE_DEFAULT_TIMEZONE: z.string().default('Australia/Sydney'),
  VITE_GIT_SHA: z.string().default('dev'),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('[env] invalid Vite configuration', parsed.error.flatten().fieldErrors);
  throw new Error('apps/web: invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
