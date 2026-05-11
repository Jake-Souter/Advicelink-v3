/**
 * Single source of truth for `apps/api` env vars.
 *
 * REBUILD_PLAN.md §11.5 forbids any other file in the workspace from reading
 * `process.env` directly — eslint enforces this; the disable above is the
 * single intentional exception.
 *
 * Full inventory in REBUILD_PLAN §19.19.1; classification key:
 *   [copies]   — same name as the legacy .env; copy across unchanged
 *   [NEW]      — new for v3; create in Doppler/Railway
 *   [v3-only]  — does not exist in legacy
 *
 * The loader fails fast on boot if any required var is missing or invalid.
 */
import { z } from 'zod';

const stringWithFallback = (envVar: string, fallback?: string) => process.env[envVar] ?? fallback;

// Doppler stores absent values as the empty string. Coerce '' → undefined so
// `.optional()` actually behaves as expected for vars whose backing service
// hasn't been provisioned yet (e.g. AWS S3 until WP-4, DocuSign until WP-10).
const optStr = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().min(1).optional(),
);
const optUrl = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().url().optional(),
);
const optEmail = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.string().email().optional(),
);

// Anthropic accepts either ANTHROPIC_API_KEY (preferred) or the legacy
// CLAUDE_API_KEY for a 30-day transition window (REBUILD_PLAN §19.12.9).
const anthropicKey =
  stringWithFallback('ANTHROPIC_API_KEY') ?? stringWithFallback('CLAUDE_API_KEY');
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  console.warn('[env] CLAUDE_API_KEY is deprecated; rename the secret to ANTHROPIC_API_KEY.');
}

// Railway exposes two URLs per managed service: the *internal* `DATABASE_URL`
// / `REDIS_URL` (only routable inside the Railway private network) and the
// optional `DATABASE_PUBLIC_URL` / `REDIS_PUBLIC_URL` (TCP proxy, routable
// from anywhere). Prefer the public URL if Doppler has it (used by laptops
// running `doppler run`), otherwise fall back to the internal URL (used by
// deployed Railway services so traffic stays on the private network and
// avoids egress charges).
const databaseUrl = stringWithFallback('DATABASE_PUBLIC_URL') ?? stringWithFallback('DATABASE_URL');
const redisUrl = stringWithFallback('REDIS_PUBLIC_URL') ?? stringWithFallback('REDIS_URL');

// Firebase private keys are stored with literal \n in Doppler/Railway. Convert
// to real newlines before validation (matches the legacy convention).
const normalisePem = (raw: string | undefined): string | undefined => raw?.replace(/\\n/g, '\n');

const schema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_PER_MIN_DEFAULT: z.coerce.number().int().positive().default(600),

  // URLs
  APP_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),

  // Tenancy resolution. Subdomain support is wired through the loader so we
  // can flip it on once Cloudflare DNS is provisioned without a code change.
  // See REBUILD_PLAN §2.2 — at v1 we use path-prefix only.
  SUBDOMAIN_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),

  // Datastores
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Object storage. Optional at v1 boot — required by branding-storage and
  // document-renderer code paths, which land in WP-4 and WP-9. Code that needs
  // them asserts presence at the call site.
  S3_BUCKET: optStr,
  S3_REGION: z.string().default('ap-southeast-2'),
  S3_ACCESS_KEY_ID: optStr,
  S3_SECRET_ACCESS_KEY: optStr,
  S3_KMS_KEY_ID: optStr,

  // Firebase Auth
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((v) => normalisePem(v)!),
  // Used only by the get-id-token CLI smoke-test script (read from the
  // Firebase Web SDK config — public, but lives in Doppler so dev tools
  // don't need a separate config file).
  FIREBASE_WEB_API_KEY: optStr,

  // Anthropic Claude
  ANTHROPIC_API_KEY: optStr,
  ANTHROPIC_DEFAULT_MODEL: z.string().default('claude-3-7-sonnet-20250219'),

  // DocuSign (JWT Grant)
  DOCUSIGN_INTEGRATION_KEY: optStr,
  DOCUSIGN_USER_ID: optStr,
  DOCUSIGN_ACCOUNT_ID: optStr,
  DOCUSIGN_PRIVATE_KEY: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z
      .string()
      .min(1)
      .optional()
      .transform((v) => (v ? normalisePem(v)! : undefined)),
  ),
  DOCUSIGN_BASE_URI: optUrl,
  DOCUSIGN_WEBHOOK_BASE_URL: optUrl,
  DOCUSIGN_WEBHOOK_SECRET: optStr,

  // Adobe Sign — Phase B
  ADOBESIGN_CLIENT_ID: optStr,
  ADOBESIGN_CLIENT_SECRET: optStr,
  ADOBESIGN_REDIRECT_URI: optUrl,

  // Microsoft Graph (calendar)
  MICROSOFT_CLIENT_ID: optStr,
  MICROSOFT_CLIENT_SECRET: optStr,
  MICROSOFT_REDIRECT_URI: optUrl,
  MICROSOFT_TENANT: z.string().default('common'),

  // Google Calendar — Phase B
  GOOGLE_CLIENT_ID: optStr,
  GOOGLE_CLIENT_SECRET: optStr,
  GOOGLE_REDIRECT_URI: optUrl,

  // OmniLife (Basic Auth, v4.58 locked)
  OMNILIFE_USERNAME: optStr,
  OMNILIFE_PASSWORD: optStr,
  OMNILIFE_BASE_URL: optUrl,
  OMNILIFE_GROUP_ID: z.string().default('ExampleGroup'),

  // SendGrid
  SENDGRID_API_KEY: optStr,
  SENDGRID_FROM_EMAIL: optEmail,
  SENDGRID_FROM_NAME: optStr,

  // Observability
  SENTRY_DSN: optUrl,
  POSTHOG_KEY: optStr,
  POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
  HONEYCOMB_API_KEY: optStr,
  OTEL_SERVICE_NAME: z.string().default('api'),
});

const parsed = schema.safeParse({
  ...process.env,
  ANTHROPIC_API_KEY: anthropicKey,
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
});

// Test-mode escape hatch: vitest may import modules that transitively pull
// in this loader (e.g. tRPC routers used by integration tests) even when
// the test itself plans to skip due to missing real env. Crashing at
// module load makes describe-level `skipIf(!databaseUrl)` unreachable.
// In test mode we therefore degrade to a stub that lets module graphs
// load; tests that need a real value still gate on `process.env.*`
// themselves and skip cleanly.
const inVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

if (!parsed.success) {
  console.error('[env] invalid configuration', parsed.error.flatten().fieldErrors);
  if (!inVitest) {
    throw new Error('apps/api: invalid environment configuration');
  }
  console.warn(
    '[env] running under vitest with missing/invalid env — supplying stub values; integration tests must skip on missing real env.',
  );
}

const stubEnv: z.infer<typeof schema> = {
  NODE_ENV: 'test',
  PORT: 4001,
  LOG_LEVEL: 'fatal',
  RATE_LIMIT_PER_MIN_DEFAULT: 600,
  APP_BASE_URL: 'http://localhost:4001',
  WEB_BASE_URL: 'http://localhost:3000',
  SUBDOMAIN_ENABLED: false,
  DATABASE_URL: 'postgres://stub:stub@localhost:5432/stub',
  REDIS_URL: 'redis://localhost:6379',
  S3_REGION: 'ap-southeast-2',
  FIREBASE_PROJECT_ID: 'stub-project',
  FIREBASE_CLIENT_EMAIL: 'stub@example.test',
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----\n',
  ANTHROPIC_DEFAULT_MODEL: 'claude-3-7-sonnet-20250219',
  MICROSOFT_TENANT: 'common',
  OMNILIFE_GROUP_ID: 'ExampleGroup',
  POSTHOG_HOST: 'https://app.posthog.com',
  OTEL_SERVICE_NAME: 'api',
} as z.infer<typeof schema>;

export const env: z.infer<typeof schema> = parsed.success ? parsed.data : stubEnv;
export type Env = typeof env;
