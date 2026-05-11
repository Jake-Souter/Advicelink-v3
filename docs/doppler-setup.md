# Doppler setup

Doppler is the only place real secrets live. The repo is configured for
**three Doppler projects** (one per app) so secrets can be granted to humans
and CI runners with minimum scope.

## One-time install

```bash
brew install gnupg dopplerhq/cli/doppler
doppler login
```

## Create the projects (one-time, by an admin)

```bash
doppler projects create advicelink-api
doppler projects create advicelink-workers
doppler projects create advicelink-web
```

Each project gets three configs out of the box: `dev`, `stg`, `prd`. Add
the env vars per `REBUILD_PLAN.md` §19.19. The full inventory:

- `apps/api` → §19.19.1
- `apps/workers` → §19.19.2
- `apps/web` → §19.19.3 (only `VITE_*` vars are exposed to the browser)

## Local-developer onboarding

```bash
# From the repo root
doppler setup --no-interactive --project advicelink-api     --config dev --path apps/api
doppler setup --no-interactive --project advicelink-workers --config dev --path apps/workers
doppler setup --no-interactive --project advicelink-web     --config dev --path apps/web
```

This writes `apps/*/.doppler.json` (gitignored) so each app picks up the
right project automatically.

Then run dev with secrets injected:

```bash
doppler run -- pnpm dev
```

Per-app:

```bash
cd apps/api     && doppler run -- pnpm dev
cd apps/workers && doppler run -- pnpm dev
cd apps/web     && doppler run -- pnpm dev
```

## Railway / Vercel integration

- Railway pulls Doppler config at deploy time using the
  [Doppler-Railway integration](https://docs.doppler.com/docs/railway).
  Wire `advicelink-api` to the API service and `advicelink-workers` to the
  workers service in each environment.
- Vercel pulls via the
  [Doppler-Vercel integration](https://docs.doppler.com/docs/vercel) for
  `advicelink-web`.

## Secret rotation

- Rotate Anthropic, OmniLife, DocuSign, SendGrid, Microsoft, Google,
  Firebase quarterly minimum. Doppler tracks rotation events; the
  `admin_audit_log` mirrors rotations once that table lands.
- Per-tenant `pgcrypto` keys (`TENANT_ENC_KEY__<slug>`) rotate yearly with
  a 30-day dual-write window — see `REBUILD_PLAN.md` §19.16.

## Until Doppler is wired

The Zod env loader in `apps/*/src/config/env.ts` falls back to plain
`process.env`, so a developer can put secrets in a local `.env.local`
(gitignored) for early-stage work. **Do not commit `.env.local`.** Once
Doppler is provisioned, remove your local `.env.local` and use `doppler run`.
