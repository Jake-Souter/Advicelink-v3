/**
 * Single source of truth for `apps/workers` env vars.
 *
 * Inherits the same shape as the API where shared (DATABASE_URL, REDIS_URL,
 * S3_*, integration credentials) plus worker-specific knobs from
 * REBUILD_PLAN §19.19.2.
 */
import { z } from 'zod';

const normalisePem = (raw: string | undefined): string | undefined => raw?.replace(/\\n/g, '\n');

const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;

// Prefer Railway public TCP-proxy URLs when present (used by laptops running
// `doppler run`); fall back to the internal URLs (used by deployed Railway
// services so traffic stays on the private network).
const databaseUrl = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_PUBLIC_URL ?? process.env.REDIS_URL;

// Doppler stores absent values as empty strings — coerce them to undefined.
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

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTEL_SERVICE_NAME: z.string().default('workers'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // Object storage. Optional at v1 boot — required by document-renderer
  // code paths (WP-9). Asserted at call sites that need them.
  S3_BUCKET: optStr,
  S3_REGION: z.string().default('ap-southeast-2'),
  S3_ACCESS_KEY_ID: optStr,
  S3_SECRET_ACCESS_KEY: optStr,
  S3_KMS_KEY_ID: optStr,

  // Worker tuning
  WORKER_QUEUES: z
    .string()
    .default('documents,ai,esign,cron,virusScan')
    .transform((v) =>
      v
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean),
    ),
  WORKER_CONCURRENCY_DOCUMENTS: z.coerce.number().int().positive().default(4),
  WORKER_CONCURRENCY_AI: z.coerce.number().int().positive().default(2),

  // Optional ClamAV for virus scan of client uploads
  CLAMAV_HOST: z.string().default('clamav'),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  // Integrations (optional at boot; needed by the matching processor)
  ANTHROPIC_API_KEY: optStr,
  ANTHROPIC_DEFAULT_MODEL: z.string().default('claude-3-7-sonnet-20250219'),

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

  OMNILIFE_USERNAME: optStr,
  OMNILIFE_PASSWORD: optStr,
  OMNILIFE_BASE_URL: optUrl,
  OMNILIFE_GROUP_ID: z.string().default('ExampleGroup'),

  SENDGRID_API_KEY: optStr,
  SENDGRID_FROM_EMAIL: optEmail,
  SENDGRID_FROM_NAME: optStr,

  SENTRY_DSN: optUrl,
  HONEYCOMB_API_KEY: optStr,
});

const parsed = schema.safeParse({
  ...process.env,
  ANTHROPIC_API_KEY: anthropicKey,
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
});
if (!parsed.success) {
  console.error('[env] invalid configuration', parsed.error.flatten().fieldErrors);
  throw new Error('apps/workers: invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
