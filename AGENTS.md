# Agent guidance — Advicelink v3

This file mirrors `.cursor/rules/*.mdc` for non-Cursor agents (Claude Code, Codex CLI, etc.). The single source of truth for product, schema, and architectural decisions is **`REBUILD_PLAN.md`** at the repo root.

## Hard non-negotiables

1. **Canonical names everywhere.** SOA Wizard, ROA / EO Wizard, AR Wizard. Never use legacy names (`Advice`, `Amendments`).
2. **Documents are DOCX-only.** No PDFs, no Puppeteer, no `html-to-docx`, no Pandoc.
3. **No string-typed workflow status comparisons.** Use helpers from `@advicelink/workflow`.
4. **No raw SQL in feature code.** Use Drizzle through `services/<feature>/repository.ts`.
5. **No prompts inlined in feature code.** Use `callClaude(promptKey, ...)` from `@advicelink/ai`.
6. **No env reads outside `apps/*/src/config/env.ts`.**
7. **No styling in `apps/web/src/app/routes/**`or`apps/web/src/features/**`.** Use semantic components from `@advicelink/ui`.
8. **No raw hex / px values outside `packages/ui/src/tokens/`.**
9. **No cross-feature imports.** Cross-cutting code lives in `@advicelink/ui`.
10. **Three layers of authorisation always.** tRPC `tenantAndRole` → service `assertCanAccessClient` → Postgres RLS.
11. **No secrets in the repo.** Doppler only. Local dev: `doppler run -- pnpm dev`.

## Definition of done — see `REBUILD_PLAN.md` §17.

## Build sequence — see `REBUILD_PLAN.md` §18 (14 work packages).

## Conventions

- Package scope: `@advicelink/*`
- Node 22 LTS, pnpm 9, Turborepo 2
- Tenant resolution at v1: **path-prefix** (`/t/<slug>/...`). Subdomain support is wired in the env loader (`SUBDOMAIN_ENABLED`) but disabled until Cloudflare DNS is provisioned.
- Launching tenant: **Ready Advice** (slug `ready-advice`).
- File size caps: 600 lines (api), 400 lines (web).

## Where to look first

| Concern              | File                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| Product spec         | `REBUILD_PLAN.md`                                                    |
| Cursor / agent rules | `.cursor/rules/*.mdc`                                                |
| Per-app env loader   | `apps/*/src/config/env.ts`                                           |
| Workflow machine     | `packages/workflow/src/clientWorkflow.ts` (Package 5)                |
| Brand resolver       | `packages/branding/src/resolveBrand.ts`                              |
| AI prompt registry   | `packages/ai/src/registry.ts`                                        |
| Document templates   | `packages/document-templates/` + S3 `tenants/{tenant_id}/templates/` |
