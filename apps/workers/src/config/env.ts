/* eslint-disable no-restricted-syntax -- this file is the sole sanctioned env reader */
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

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OTEL_SERVICE_NAME: z.string().default('workers'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default('ap-southeast-2'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_KMS_KEY_ID: z.string().min(1),

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
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_DEFAULT_MODEL: z.string().default('claude-3-7-sonnet-20250219'),

  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_USER_ID: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? normalisePem(v)! : undefined)),
  DOCUSIGN_BASE_URI: z.string().url().optional(),

  OMNILIFE_USERNAME: z.string().optional(),
  OMNILIFE_PASSWORD: z.string().optional(),
  OMNILIFE_BASE_URL: z.string().url().optional(),
  OMNILIFE_GROUP_ID: z.string().default('ExampleGroup'),

  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().optional(),

  SENTRY_DSN: z.string().url().optional(),
  HONEYCOMB_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse({ ...process.env, ANTHROPIC_API_KEY: anthropicKey });
if (!parsed.success) {
  console.error('[env] invalid configuration', parsed.error.flatten().fieldErrors);
  throw new Error('apps/workers: invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
