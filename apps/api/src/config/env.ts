/* eslint-disable no-restricted-syntax -- this file is the sole sanctioned env reader */
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

// Anthropic accepts either ANTHROPIC_API_KEY (preferred) or the legacy
// CLAUDE_API_KEY for a 30-day transition window (REBUILD_PLAN §19.12.9).
const anthropicKey =
  stringWithFallback('ANTHROPIC_API_KEY') ?? stringWithFallback('CLAUDE_API_KEY');
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  console.warn('[env] CLAUDE_API_KEY is deprecated; rename the secret to ANTHROPIC_API_KEY.');
}

// Firebase private keys are stored with literal \n in Doppler/Railway. Convert
// to real newlines before validation (matches the legacy convention).
const normalisePem = (raw: string | undefined): string | undefined => raw?.replace(/\\n/g, '\n');

const schema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
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

  // Object storage
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default('ap-southeast-2'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_KMS_KEY_ID: z.string().min(1),

  // Firebase Auth
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((v) => normalisePem(v)!),

  // Anthropic Claude
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_DEFAULT_MODEL: z.string().default('claude-3-7-sonnet-20250219'),

  // DocuSign (JWT Grant)
  DOCUSIGN_INTEGRATION_KEY: z.string().min(1).optional(),
  DOCUSIGN_USER_ID: z.string().min(1).optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().min(1).optional(),
  DOCUSIGN_PRIVATE_KEY: z
    .string()
    .min(1)
    .optional()
    .transform((v) => (v ? normalisePem(v)! : undefined)),
  DOCUSIGN_BASE_URI: z.string().url().optional(),
  DOCUSIGN_WEBHOOK_BASE_URL: z.string().url().optional(),
  DOCUSIGN_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Adobe Sign — Phase B
  ADOBESIGN_CLIENT_ID: z.string().optional(),
  ADOBESIGN_CLIENT_SECRET: z.string().optional(),
  ADOBESIGN_REDIRECT_URI: z.string().url().optional(),

  // Microsoft Graph (calendar)
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_TENANT: z.string().default('common'),

  // Google Calendar — Phase B
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // OmniLife (Basic Auth, v4.58 locked)
  OMNILIFE_USERNAME: z.string().optional(),
  OMNILIFE_PASSWORD: z.string().optional(),
  OMNILIFE_BASE_URL: z.string().url().optional(),
  OMNILIFE_GROUP_ID: z.string().default('ExampleGroup'),

  // SendGrid
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  SENDGRID_FROM_NAME: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
  HONEYCOMB_API_KEY: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('api'),
});

const parsed = schema.safeParse({
  ...process.env,
  ANTHROPIC_API_KEY: anthropicKey,
});

if (!parsed.success) {
  console.error('[env] invalid configuration', parsed.error.flatten().fieldErrors);
  throw new Error('apps/api: invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
