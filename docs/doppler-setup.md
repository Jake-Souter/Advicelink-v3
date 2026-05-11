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

### `DATABASE_URL` / `REDIS_URL` — internal vs public

Railway exposes two URLs per managed service:

| variable               | scope                            | when used                                |
| ---------------------- | -------------------------------- | ---------------------------------------- |
| `DATABASE_URL`         | `*.railway.internal` (private)   | Deployed Railway services (free, faster) |
| `DATABASE_PUBLIC_URL`  | `*.proxy.rlwy.net` (TCP proxy)   | Local laptops via `doppler run`          |
| `REDIS_URL`            | `redis.railway.internal`         | Deployed Railway services                |
| `REDIS_PUBLIC_URL`     | `*.proxy.rlwy.net`               | Local laptops via `doppler run`          |

Both should live in the `advicelink-api` and `advicelink-workers` `dev` configs.
The env loader (`apps/*/src/config/env.ts`) auto-prefers `*_PUBLIC_URL` if
present, so the same Doppler config works from your laptop and inside Railway
(deployed pods don't have `*_PUBLIC_URL` injected by the integration unless
you explicitly map it). To enable: Railway → service → Settings → Networking →
**Generate Domain** under "Public Networking".

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
