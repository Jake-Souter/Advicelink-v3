# Advicelink v3

A multi-tenant CRM for Australian financial advice firms. The complete product, schema, and architecture spec lives in [`REBUILD_PLAN.md`](./REBUILD_PLAN.md).

The launching tenant at v1 is **Ready Advice** (`ready-advice`).

## Stack

- **Web**: React 19 + Vite + TanStack Router + TanStack Query → Vercel
- **API**: Fastify 5 + tRPC v11 → Railway
- **Workers**: BullMQ on Redis → Railway
- **Database**: Postgres 16 with Row-Level Security → Railway
- **Storage**: AWS S3 (`ap-southeast-2`)
- **Auth**: Firebase Auth (legacy users retained)
- **Secrets**: Doppler
- **Observability**: Sentry, PostHog, Pino, OpenTelemetry → Honeycomb

## Layout

```
apps/
  api/             Fastify + tRPC server
  web/             Vite + React 19 frontend
  workers/         BullMQ workers (documents, ai, esign, cron)
  public-site/     Marketing site (placeholder)
packages/
  db/              Drizzle schema, migrations, seed
  schemas/         Zod schemas for every entity + DTOs
  workflow/        XState v5 client workflow machine
  ui/              Tokens, primitives, atoms, molecules, semantic components
  branding/        Brand bundle resolver, OKLCH derivation
  rbac/            canAccessClient, canAccessPage helpers
  ai/              Claude client + prompt registry runtime
  esign/           EsignPort + DocuSign + Adobe Sign adapters
  insurance-quoting/   InsuranceQuotePort + OmniLife adapter
  research/        Lonsec adapter (Phase B)
  calendar/        CalendarPort + Microsoft + Google adapters
  projections-engine/  Sandboxed evaluator + assumptions resolver
  insurance-engine/    Sandboxed needs-analysis evaluator
  document-renderer/   docxtemplater pipeline + image insertion
  document-templates/  Template authoring tooling, manifest schemas
  chart-renderer/  chartjs-node-canvas wrappers
  analytics/       PostHog wrapper, event taxonomy
  logger/          Pino + OTel
  email/           SendGrid client + template index
  strings/         Backend strings (locale-aware)
  tsconfig/        Shared TypeScript configs
  eslint-config/   Shared ESLint config
  prettier-config/ Shared Prettier config
.cursor/rules/     Cursor agent rules (mirror of AGENTS.md)
```

## Local development

```bash
# 1. Install Node 22 (use nvm)
nvm use

# 2. Enable corepack (gives you the pinned pnpm version)
corepack enable

# 3. Install dependencies
pnpm install

# 4. Start the workspace in dev mode
#    (once Doppler is configured, prefix with: doppler run -- )
pnpm dev
```

## Doppler setup (first-time)

See [`docs/doppler-setup.md`](./docs/doppler-setup.md). Until Doppler is wired, each app's env loader will fall back to `.env.local` for local development; `.env.local` is `.gitignore`d.

## Build & test

```bash
pnpm typecheck    # tsc across the workspace
pnpm lint         # eslint across the workspace
pnpm test         # vitest across packages and apps
pnpm build        # turbo build, all apps + packages
```

## Cutover plan

See `REBUILD_PLAN.md` §14.4 — fresh-start cutover, no data migration. The legacy app stays at `legacy.advicelink.com` for 30 days as a read-only fallback.
