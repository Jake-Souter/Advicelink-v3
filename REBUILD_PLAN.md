# Advicelink — Development Plan ("v3")

> A complete, self-contained specification for building Advicelink from scratch.
>
> This document is intended to be the **only** reference required to implement the
> system. It captures the product domain, every role and capability, every page,
> every workflow state, every data model, every integration, the document
> generation strategy, the multi-tenancy model, the brand-theming model, the
> hosting plan, and the cutover plan.
>
> Audience: a single, well-resourced engineering team building a brand-new
> codebase. There is no expectation of importing logic from any earlier version —
> all required behaviour is specified here.

---

## 0. Reading guide

- §1–3 set the product and tenancy foundations.
- §4 defines roles and access.
- §5 defines the workflow state machine.
- §6 defines all pages and what each is for.
- §7 defines the data model.
- §8 defines document generation (DOCX-only).
- §9 defines integrations.
- §10 defines admin / configuration surfaces (page visibility, required fields,
  AI prompts, projection settings, insurance settings, portfolios, brand assets).
- §11 defines the architecture and folder structure.
- §12 defines security and compliance.
- §13 defines testing.
- §14 defines DevOps, hosting on Railway, and the cutover-on-existing-domain
  plan.
- §15 answers PWA vs native.
- §16 lists open items deferred to "later".
- §17 is the definition of done.
- §18 is the build team's quick-start checklist.

### 0.1 Naming conventions

To avoid the historic confusion between in-app labels, route slugs, file paths,
and backend module names, **the same canonical name is used everywhere**:

| Concept | Tab key (state) | UI label | Route slug | Frontend feature folder | Backend service module |
|---|---|---|---|---|---|
| GA Portal | `clients` | GA Portal | `/portal/clients` | `features/portals/lead-gen/` | `services/clients/` |
| Adviser Portal | `adviserPortal` | Adviser Portal | `/portal/adviser` | `features/portals/adviser/` | `services/clients/` |
| Paraplanner Portal | `paraplannerPortal` | Paraplanner Portal | `/portal/paraplanner` | `features/portals/paraplanner/` | `services/clients/` |
| UF Support Portal | `ufSupportPortal` | UF Support Portal | `/portal/uf-support` | `features/portals/uf-support/` | `services/clients/` |
| AR Support Portal | `arSupportPortal` | AR Support Portal | `/portal/ar-support` | `features/portals/ar-support/` | `services/clients/` |
| AR Portal | `arPortal` | AR Portal | `/portal/ar-adviser` | `features/portals/ar-adviser/` | `services/clients/` |
| Import Workbench | `importWorkbench` | Import Workbench | `/portal/import-workbench` | `features/import-workbench/` | `services/legacy-import/` |
| Client Overview | `clientOverview` | Client Overview | `/clients/$id/overview` | `features/client-overview/` | — |
| Strategy | `strategy` | Strategy | `/clients/$id/strategy` | `features/strategy/` | `services/strategy/` |
| Calendar | `calendar` | Calendar | `/clients/$id/calendar` | `features/calendar/` | `services/calendar/` |
| Fact Find | `factFind` | Fact Find | `/clients/$id/fact-find` | `features/fact-find/` | `services/fact-find/` |
| **SOA Wizard** | **`soaWizard`** | **SOA Wizard** | **`/clients/$id/soa-wizard`** | **`features/soa-wizard/`** | **`services/soa-wizard/`** |
| **ROA / EO Wizard** | **`roaEoWizard`** | **ROA / EO Wizard** | **`/clients/$id/roa-eo-wizard`** | **`features/roa-eo-wizard/`** | **`services/roa-eo-wizard/`** |
| AR Wizard | `arWizard` | AR Wizard | `/clients/$id/ar-wizard` | `features/ar-wizard/` | `services/ar-wizard/` |
| Implementation Checklist | `implementationChecklist` | Implementation Checklist | `/clients/$id/implementation-checklist` | `features/implementation-checklist/` | `services/implementation/` |
| Reverse Fact Find | `reverseFactFind` | Reverse Fact Find | `/clients/$id/reverse-fact-find` | `features/reverse-fact-find/` | `services/reverse-fact-find/` |
| Quick Quote | `quickQuote` | Quick Quote | `/quick-quote` | `features/quick-quote/` | `services/insurance/` |
| Projections | `projections` | Projections | `/projections` | `features/projections/` | `services/projections/` |
| Envelopes | `eSignatures` | Envelopes | `/clients/$id/envelopes` | `features/envelopes/` | `services/esign/` |
| Document Storage | `documents` | Document Storage | `/clients/$id/documents` | `features/documents/` | `services/storage/` |
| File Notes | `fileNotes` | File Notes | `/clients/$id/file-notes` | `features/file-notes/` | `services/file-notes/` |
| File Note (auto) | `fileNote` | File Note | `/clients/$id/file-note/$id` | `features/file-notes/` | `services/file-notes/` |
| Audit Log | `auditLog` | Audit Log | `/clients/$id/audit-log` | `features/audit-log/` | `services/audit/` |
| Admin | `admin` | Admin | `/admin` | `features/admin/` | various |
| Document Maps | `documentMaps` | Document Maps | `/admin/document-maps` | `features/admin-maps/` | — |
| Page Maps | `pageMaps` | Page Maps | `/admin/page-maps` | `features/admin-maps/` | — |
| Workflow Maps | `workflowMaps` | Workflow Maps | `/admin/workflow-maps` | `features/admin-maps/` | — |
| Run Tests | `runTests` | Run Tests | `/admin/run-tests` | `features/admin-runtests/` | — |

These names are identical across the codebase. Lint rules enforce that
component file names match the canonical `PascalCase` form
(`SoaWizard.tsx`, `RoaEoWizard.tsx`).

---

## 1. Product summary

Advicelink is a **multi-tenant CRM** for Australian financial advice firms. Each
firm ("tenant") has multiple internal teams. Two team families collaborate on a
client journey:

1. **Lead Gen (marketing) teams** — capture leads, run the initial Fact Find,
   hand the client to an Advice team.
2. **Advice teams** — comprised of multiple sub-roles (Adviser, Paraplanner, UF
   Support, AR Support, AR Adviser, Management, Legacy Import), they produce a
   Statement of Advice (SOA), present it, implement it, and run Annual Reviews
   indefinitely.

The **two team families must be strictly partitioned**: a Lead Gen user can
never see a client that has been handed off to an Advice team beyond the Fact
Find stage, and Advice users can never see leads that have not been assigned to
them.

The product also generates compliance-grade documents (Statements of Advice,
Records of Advice, Engagement Letters, Annual Review letters, Authorities,
Disclosures, Client Service Agreements). **All documents are produced as DOCX**
so advisers, compliance staff, and clients can edit them in Microsoft Word.
The application does **not** generate PDFs — if a customer needs a PDF, they
convert in Word (File → Export → PDF) or in their preferred tool.

The Excel Power Query "data tap" present in the legacy app is **removed** from
v3. Advisers who maintain external Excel workbooks should use Word/DOCX exports
or a future read-only reporting API.

---

## 2. Multi-tenancy model

### 2.1 Tenant definition

A **tenant** is a financial advice business. Each tenant owns:
- Marketing teams
- Advisory teams
- Paraplanner teams
- Super-admin users (per tenant)
- Brand assets (logo, colours, fonts, page header/footer, AFSL/licensee details)
- Admin configuration (page visibility, required fields, SOA Wizard section
  order, AI prompts, insurance settings, projection settings, recommended
  portfolios, alternative portfolios, feature flags, DOCX template overrides)
- Clients (children of tenant)

A user belongs to exactly one tenant. There is also a **platform super-admin**
role that spans all tenants (Advicelink staff only).

### 2.2 Tenant resolution

Two-prong resolution, evaluated in order:

1. Custom subdomain — `acme.advicelink.com` resolves to `tenant_id=acme`.
2. Path prefix on the canonical domain — `app.advicelink.com/t/acme/...`.

The user's JWT carries `tenant_id` after login. Mismatch between URL tenant and
JWT tenant → 403.

### 2.3 Tenant isolation

- Every Postgres table for tenant-owned data has `tenant_id UUID NOT NULL`.
- Row-Level Security (RLS) is enabled on every such table; the policy uses a
  session variable `app.current_tenant_id` set by the API gateway from the JWT.
- Object storage prefixes every blob with `tenants/{tenant_id}/...`.
- Background workers run a single dyno that processes jobs for all tenants but
  pulls `tenant_id` out of the job payload and sets the session variable before
  any DB read.

### 2.4 Tenant onboarding

A platform super-admin creates a tenant via a back-office UI. Inputs:
`tenant_id` (slug), display name, primary domain, brand asset bundle (see
§10.7), seed admin email. The seed admin receives an invite email and becomes
the tenant's first super-admin.

### 2.5 Per-tenant branding

See §10.7 for the brand-themeability spec. Every document, email, login screen,
and DOCX export must respect the resolved tenant's brand bundle.

### 2.6 Lead-gen tenancy (cross-tenant client creation)

Added in WP-5.5. Advicelink supports two tenant kinds, discriminated
by `tenants.kind`:

- **`'advice'`** — a financial advice firm. Owns advisers,
  paraplanners, AR support, etc. Every signed onboarding pack
  ultimately lands in an advice tenant.
- **`'lead_gen'`** — an external lead-generation agency that captures
  leads on behalf of one or more advice firms. Owns lead-gen users
  only. Has no paraplanners, advisers, or AR roles.

#### 2.6.1 Cross-tenant access via `lead_gen_grants`

A grant is a row in `lead_gen_grants`:
`(lead_gen_tenant_id, advice_tenant_id, granted_by_user_id, granted_at,
revoked_at)`. Issued by a `tenant_super_admin` of the **advice** firm
via the "Lead-gen partners" admin page; soft-revoked by setting
`revoked_at`. A partial unique index on
`(lead_gen_tenant_id, advice_tenant_id) WHERE revoked_at IS NULL`
enforces "one active grant per pair" while preserving history. The
agency cannot self-grant.

A trigger on `lead_gen_grants` enforces that
`tenants(lead_gen_tenant_id).kind = 'lead_gen'` and
`tenants(advice_tenant_id).kind = 'advice'` so the rows can never
mis-shape.

#### 2.6.2 The `clients` row carries three tenant pointers

When the `clients` table lands in WP-7 it has three tenant
references, two immutable, one that flips:

- `originating_lead_gen_tenant_id` — the agency that captured the
  lead. **Set at creation, never modified.** Nullable to allow
  self-sourced clients (no agency was involved); non-null for every
  client created by a `lead_gen` user.
- `destination_advice_tenant_id` — the advice firm the lead is sold
  to. **Set at creation, never modified.** Required to be non-null
  for any client created by a `lead_gen` user; chosen at the
  lead-creation form from the agency's granted-firms dropdown and
  validated server-side against `lead_gen_grants`.
- `tenant_id` — the **active owner**. Equals the lead-gen tenant
  during phases 1–3 of the workflow (factFinding through
  presentingSOA), and equals the advice tenant from
  `welcomeCallScheduled` onwards. The flip is an atomic transaction
  inside the DocuSign webhook handler that processes the CSA
  signature: the `tenant_id` UPDATE and the
  `presentingSOA → welcomeCallScheduled` workflow transition land
  together. Terminal `lost` rows keep `tenant_id` pinned to the
  lead-gen tenant.

#### 2.6.3 Dual-tenant RLS on `clients`

The `clients` policy (defined when the table is created in WP-7)
admits BOTH named partner tenants for reads, and gates writes by the
active owner tenant plus a pre-handover write window for the SOA
production team:

```sql
USING (
  app_current_user_role() = 'platform_super_admin'
  OR app_current_tenant_id() IN (
    originating_lead_gen_tenant_id,
    destination_advice_tenant_id
  )
)
WITH CHECK (
  -- Default: writes only from the active owner tenant.
  app_current_tenant_id() = tenant_id

  -- Pre-handover SOA-production write window: the destination advice
  -- firm's paraplanner / adviser / uf_support can write to a row
  -- still owned by the lead-gen tenant during phases 2 + 3.
  OR (
    app_current_tenant_id() = destination_advice_tenant_id
    AND tenant_id = originating_lead_gen_tenant_id
  )
)
```

Per-role / per-phase visibility (e.g. "advice-tenant `paraplanner`
should only see this row during `draftingSOA / reviewingSOA /
amendingSOA`") is enforced by the application layer's
`assertCanAccessClient(userId, clientId)` helper plus the page access
matrix (§4.4) — RLS is the perimeter, the app layer is the
ergonomics.

#### 2.6.4 Privacy of lead-gen losses

When lead-gen marks a client `lost` (the "Client Lost" button), the
destination advice firm is **not** notified and does **not** see the
row. The terminal `lost` state stays owned by the lead-gen tenant;
the destination tenant's view of "leads in flight" simply never sees
that row.

Future grants management surface, lead-gen agency portals, and the
lead-creation form for cross-tenant scenarios are scoped to a later
WP — WP-5.5 ships the schema (`tenants.kind`, `lead_gen_grants`) and
the workflow contract; WP-7 adds the `clients` table with the
dual-tenant RLS policy above.

---

## 3. High-level architecture

```
                              ┌──────────────┐
                              │  Cloudflare  │   DNS, WAF, CDN
                              └──────┬───────┘
                                     │
     ┌───────────────────────────────┼───────────────────────────────┐
     │                               │                               │
┌────▼─────┐                  ┌──────▼──────┐                 ┌──────▼──────┐
│  Web App │  HTTPS           │   API       │  HTTPS          │  Public     │
│ (Vite +  │ ─────────────►   │  (Fastify)  │ ◄──── webhooks  │  Site       │
│  React)  │                  │             │                 │ (advicelink │
│ Vercel   │ tRPC             │  Railway    │                 │  .org)      │
└──────────┘                  └─────┬───────┘                 └─────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
            ┌─────▼─────┐    ┌──────▼──────┐    ┌─────▼─────┐
            │ Postgres  │    │   Redis     │    │  Storage  │
            │ (Railway) │    │ (Railway)   │    │  (S3)     │
            └───────────┘    └─────┬───────┘    └───────────┘
                                   │
                             ┌─────▼─────┐
                             │  Workers  │   BullMQ:
                             │ (Railway) │   - documents (DOCX render)
                             └───────────┘   - ai
                                              - cron
                                              - docusign-webhooks
                                              - virus-scan
```

Everything runs on Railway except the frontend (Vercel — preview environments
per PR) and object storage (AWS S3 in `ap-southeast-2`). Cloudflare sits in
front of all public hostnames for DNS, WAF, rate limiting, and bot mitigation.

The API surface is **tRPC end-to-end**; there is no REST contract for external
consumers in v3. Webhooks (DocuSign, Adobe Sign) are the only non-tRPC HTTP
endpoints, and they live under `/webhooks/*`.

---

## 4. Roles and access control

### 4.1 Role catalogue

Roles are flat strings stored on the `users` table. A user has exactly one role
within a tenant. Cross-tenant roles are not supported (one user = one tenant).

| Role | Belongs to team type | Purpose |
|---|---|---|
| `platform_super_admin` | none (Advicelink staff) | Manage tenants, hard-impersonate, view all tenant data for support |
| `tenant_super_admin` | tenant-wide | Manage all teams, all users, all clients within the tenant |
| `lead_gen` | Marketing team | Capture leads, run Fact Find, hand off |
| `adviser` | Advisory team | Authoring adviser; owns the SOA, attends meetings, signs off advice |
| `paraplanner` | Paraplanner team (or shared pool) | Builds the SOA Wizard sections; claims clients from a queue |
| `uf_support` | Advisory team | Support before the client is advised (Fact Find QA, document chasing) |
| `ar_support` | Advisory team | Support after the client is advised (implementation, ongoing service) |
| `ar_adviser` | Advisory team | Conducts Annual Reviews; can promote a review to a formal ROA / EO Wizard run |
| `management` | Advisory team | Read-only across the team for reporting, plus AR re-allocation rights |
| `legacy_import` | tenant-wide | Brings in clients from legacy systems via the Import Workbench |

### 4.2 Two team families

A tenant has two non-overlapping team families:

- **Marketing family** — teams of `lead_gen` users. They run lead intake and
  initial Fact Find. Once a client is handed off to an Advice team, the
  marketing user **loses access** to that client.
- **Advice family** — teams of `adviser`, `paraplanner`, `uf_support`,
  `ar_support`, `ar_adviser`, and `management` users. They run the rest of the
  client lifecycle. They cannot see clients still owned by Marketing.

Hand-off is a one-way operation (see §5.4 — `handOffToAdvice` transition). It
is reversible only by `platform_super_admin` for support reasons (audit-logged).

### 4.3 Page access matrix

Every UI page declares the roles permitted to load it. The complete default
matrix is below; tenant super-admins can tighten further per advisory team
(see §10.1 page visibility overrides).

```
                          plat tenant lead   advis para  uf    ar    ar    mgmt  legacy
                          sa   sa     gen    er   plan  sup   sup   adv         imp
GA Portal                  ✓    ✓     ✓
Adviser Portal             ✓    ✓            ✓                 ✓     ✓     ✓
Paraplanner Portal         ✓    ✓                  ✓
UF Support Portal          ✓    ✓                        ✓
AR Support Portal          ✓    ✓                              ✓     ✓     ✓
AR Portal                  ✓    ✓                                    ✓
Import Workbench           ✓    ✓                                                ✓
Client Overview            ✓    ✓     (own) ✓     ✓     ✓     ✓     ✓     ✓     ✓
Strategy                   ✓    ✓            ✓     ✓     ✓     ✓     ✓     ✓
Calendar                   ✓    ✓            ✓                       ✓     ✓
Fact Find                  ✓    ✓     (own) ✓     ✓     ✓     ✓     ✓     ✓     ✓
SOA Wizard                 ✓    ✓            ✓     ✓     ✓                 ✓
ROA / EO Wizard            ✓    ✓            ✓                       ✓     ✓
AR Wizard                  ✓    ✓                              ✓     ✓     ✓
Implementation Checklist   ✓    ✓                              ✓     ✓     ✓
Reverse Fact Find          ✓    ✓                              ✓     ✓     ✓
Quick Quote                ✓    ✓     ✓     ✓                              ✓
Projections                ✓    ✓     ✓     ✓     ✓                        ✓
Envelopes                  ✓    ✓            ✓     ✓     ✓     ✓     ✓     ✓
Document Storage           ✓    ✓     (own) ✓     ✓     ✓     ✓     ✓     ✓     ✓
File Notes                 ✓    ✓     (own) ✓     ✓     ✓     ✓     ✓     ✓     ✓
Audit Log                  ✓    ✓            ✓                             ✓
Admin                      ✓    ✓
Document Maps              ✓    ✓
Page Maps                  ✓    ✓
Workflow Maps              ✓    ✓
Run Tests                  ✓    ✓
```

`(own)` means: only for clients the user's marketing team currently owns
(see client visibility rules below).

### 4.4 Client visibility rules

The visible-clients query for each role is:

- `platform_super_admin` — every client across every tenant.
- `tenant_super_admin` — every client within their tenant.
- `lead_gen` — clients where `client.lead_gen_team_id = user.team_id` AND
  workflow status is one of the marketing-owned states (see §5.2). Once a
  client is handed off, the marketing user no longer sees it.
- `adviser` — clients where `client.assigned_adviser_id = user.id` OR
  `client.advisory_team_id = user.team_id` AND status is in advice-team-owned
  states.
- `paraplanner` — clients where `client.claimed_paraplanner_id = user.id`
  (exclusive lock model — see 4.5) PLUS clients in the **Available** queue for
  paraplanners on the same advisory team.
- `uf_support` — clients in their advisory team in pre-advised states.
- `ar_support` — clients in their advisory team in post-advised states.
- `ar_adviser` — clients in their advisory team where status is in the AR
  family (`arDue`, `arWizard*`, `arDrafting*`, `arReviewing*`).
- `management` — every client across all advisory teams in their tenant.
- `legacy_import` — only clients in the `legacy_imported` and
  `legacy_normalising` states (a special pre-advice status).

Every server query enforces these rules through Postgres RLS policies; the
frontend only filters for ergonomics, never for security.

### 4.5 Paraplanner claim mechanic

The paraplanner claim is a **column on `clients`**, not a workflow
state. (Updated in WP-5.5 to match production.) Claim, release, and
auto-release manipulate `claimed_paraplanner_id` + `claimed_at`
without ever changing `workflow_state`.

The first paraplanner action — `lockFactFind` — moves the client from
`factFinding` into `draftingSOA`. From the moment the client enters
`draftingSOA` it appears in the Paraplanner Portal **Available queue**
of every paraplanner on the advisory team (or in the shared
paraplanner pool the advisory team has been configured to draw from
— see §10.6).

A paraplanner clicks **Claim** to take exclusive ownership. The claim:

- Sets `client.claimed_paraplanner_id = user.id` and
  `client.claimed_at = now()`.
- Appends an `audit_log` row of action `paraplanner.claimed`.
- Hides the client from other paraplanners' Available queue.
- Surfaces the client in the claimer's **Claimed** queue.

A paraplanner can **release** at any time — or it auto-releases:

- The cron job `auto-paraplanner-release` runs hourly. Any client
  whose `workflow_state IN ('draftingSOA', 'amendingSOA')` and
  `claimed_at <= now() - tenant.config.paraplanner_release_window`
  has its claim cleared. The default window is **48 hours**;
  configurable per tenant in §10.5.
- `reviewingSOA` is excluded — once the SOA has been sent for
  review the adviser holds the work; the paraplanner's claim sitting
  idle is not a stalling signal.
- Releasing clears `claimed_paraplanner_id`, sets `claimed_at =
  NULL`, and appends an `audit_log` row of action
  `paraplanner.auto_released`.

A `tenant_super_admin` and the assigned `adviser` can also
force-release a claim. All claims/releases are entries in the audit
log.

### 4.6 Server-side enforcement

- All tRPC procedures pass through a `tenantAndRole` middleware that:
  1. Verifies the JWT signature.
  2. Loads the user and tenant.
  3. Sets `app.current_tenant_id` on the connection.
  4. Asserts the procedure's declared role allow-list.
- Every page-load query also calls `assertCanAccessClient(userId, clientId)`
  which reads the visibility rule for the user's role.
- Postgres RLS is the last line of defence — even a logic bug at the service
  layer cannot leak rows across tenants.

---

## 5. Workflow state machine

The client lifecycle is modelled as an explicit XState v5 machine in
`packages/workflow/src/clientWorkflow.ts`. The frontend imports this package to
render workflow chips, decide which CTAs to show, and validate transitions
optimistically; the backend imports the same package to authoritatively check
and apply transitions. **Stringly-typed status comparisons elsewhere in the
codebase are forbidden** (eslint rule `no-restricted-syntax` with a custom
selector keyed off `WORKFLOW_STATES`).

This section was rewritten in WP-5.5 to match the production
WORKFLOW_NODES tuple. The shipped state machine has 16 active states + 1
terminal across 8 macro phases, and 23 named transitions.

### 5.1 Macro phases

| # | Phase | Member states | Owning team(s) |
|---|---|---|---|
| 1 | **Fact Find** | `factFinding` | Lead Generators |
| 2 | **SOA Production** | `draftingSOA`, `reviewingSOA`, `amendingSOA` | Paraplanners (advice tenant) → Advisers (advice tenant) → Paraplanners (advice tenant) |
| 3 | **Presentation** | `presentingSOA`, `welcomeCallScheduled` | Lead Generators (presenting + signing) → Advisers (welcome call) |
| 4 | **Post-Advice** (optional) | `draftingROAEO`, `reviewingROAEO` | Paraplanners → Advisers |
| 5 | **Complete** | `implementingAdvice`, `insuranceAmendment` | UF Support, Advisers |
| 6 | **Waiting** | `waitingForAR` | AR Support |
| 7 | **Annual Review** | `dueForAR`, `arBooked`, `draftingAR`, `reviewingAR`, `arComplete` | AR Support → AR Advisers → Paraplanners → AR Advisers |
| 8 | **Closed** | `lost` | Terminal |

The lead-gen tenant owns the row through phases 1–3 (`factFinding`
through `presentingSOA`); the DocuSign-driven `recordClientSigned`
transition flips ownership to the destination advice tenant and lands
the client in `welcomeCallScheduled`.

Long-term offboarding ("we're firing this client years into ongoing
service") is **not** a workflow state — it's an admin/management
action that deletes the client row, audited via `admin_audit_log`.

### 5.2 States

```
factFind
  factFinding              (Lead Gen captures + qualifies; Fact Find lock is a flag, not a state)

soaProduction
  draftingSOA              (paraplanner — claim is a column, claimed_paraplanner_id, not a state)
  reviewingSOA             (adviser reviewing)
  amendingSOA              (paraplanner addressing comments)

presentation
  presentingSOA            (Lead Gen presents + chases CSA signature; lead-gen tenant still owns)
  welcomeCallScheduled     (advice tenant owns post-DocuSign; adviser schedules / runs welcome call)

postAdvice                 (optional branch off welcomeCallScheduled)
  draftingROAEO            (paraplanner drafting a Record Of Advice / Engagement Outline)
  reviewingROAEO           (adviser reviewing)

complete
  implementingAdvice       (UF Support working the implementation pipeline)
  insuranceAmendment       (adviser holding state; onboarding-only side branch)

waiting
  waitingForAR             (AR Support parking state; "Confirm & Update Baseline" was clicked)

annualReview
  dueForAR                 (cron auto-flagged when next_ar_due_date <= today)
  arBooked                 (AR Support has scheduled the AR meeting)
  draftingAR               (paraplanner drafting AR document, OR ar_adviser via the AR Wizard)
  reviewingAR              (ar_adviser reviewing)
  arComplete               (briefly; cleared back to implementingAdvice via DocuSign on the new CSA)

closed
  lost                     (Lead Gen pressed "Client Lost" — covers non-conversion AND sign-refusal)
```

### 5.3 Transitions

The full table (every edge is an entry in
`packages/workflow/src/transitions.ts`):

```
# Phase 1 → 2
factFinding           → draftingSOA           : lockFactFind             (paraplanner)

# Phase 2 (SOA Production loop)
draftingSOA           → reviewingSOA          : sendSOAForReview         (paraplanner)
reviewingSOA          → amendingSOA           : requestSOAChanges        (adviser)
amendingSOA           → reviewingSOA          : resubmitSOA              (paraplanner)

# Phase 2 → 3
reviewingSOA          → presentingSOA         : approveSOA               (adviser; service layer creates onboarding pack draft)

# Phase 3: DocuSign-driven tenant flip (CSA signed)
presentingSOA         → welcomeCallScheduled  : recordClientSigned       (webhook; flips clients.tenant_id)

# Phase 3 → 5
welcomeCallScheduled  → implementingAdvice    : startImplementation      (adviser)

# Phase 3 → 4 (ROA/EO branch)
welcomeCallScheduled  → draftingROAEO         : requestROAEO             (adviser)
draftingROAEO         → reviewingROAEO        : sendROAEOForReview       (paraplanner)
reviewingROAEO        → implementingAdvice    : approveROAEO             (adviser)

# Phase 5 (insurance amendment side branch — onboarding only)
implementingAdvice    → insuranceAmendment    : flagInsuranceAmendment   (adviser)
insuranceAmendment    → draftingROAEO         : requestInsuranceROAEO    (adviser)
insuranceAmendment    → implementingAdvice    : resolveInsuranceAmendment(adviser)

# Phase 5 → 7 (AR-client insurance amendment bypass)
implementingAdvice    → draftingAR            : flagInsuranceAmendmentAR (ar_adviser)

# Phase 5 → 6
implementingAdvice    → waitingForAR          : confirmImplementation    (adviser, uf_support)

# Phase 5/6 → 7 (cron, gated only on next_ar_due_date)
implementingAdvice    → dueForAR              : autoFlagARDue            (cron)
waitingForAR          → dueForAR              : autoFlagARDue            (cron)

# Phase 7 cadence
dueForAR              → arBooked              : bookAR                   (ar_support)
arBooked              → draftingAR            : requestARDocument        (ar_adviser)
draftingAR            → reviewingAR           : sendARForReview          (paraplanner)
reviewingAR           → arComplete            : approveAR                (ar_adviser)
arBooked              → arComplete            : selfServeARComplete      (ar_adviser; AR Wizard self-serve bypass)

# Phase 7 → 5: DocuSign-driven cycle restart on new CSA
arComplete            → implementingAdvice    : recordARPackSigned       (webhook; sets last_ar_completed_date + new next_ar_due_date)

# Closed
{factFinding,draftingSOA,reviewingSOA,amendingSOA,presentingSOA}
                      → lost                  : markLost                 (lead_gen; requiresReason)
```

Trigger types: `user` (role-gated), `cron` (`autoFlagARDue`), `webhook`
(`recordClientSigned`, `recordARPackSigned`), `system` (reserved for
future server-internal triggers).

Every transition records a `workflow_events` row containing `from`, `to`,
`transition_name`, `actor_id`, `actor_tenant_id`, `timestamp`, `trigger`,
and a free-form `reason` field (required for transitions whose
`requiresReason: true`, e.g. `markLost`).

### 5.4 Auto-transitions

Two automated transitions, both executable from BullMQ cron AND from
the AR Support / UF Support portal on load (with a session ref that
prevents duplicate updates within a tab):

- **`auto-ar-due`**: every client whose `workflow_state IN
  ('implementingAdvice', 'waitingForAR')` and `next_ar_due_date <=
  today (Australia/Sydney)` is moved to `dueForAR`. Gated only on the
  date — `implementation_confirmed` is intentionally NOT checked, so
  legacy mid-implementation clients also flow through after 10 months.
  Server-side cron runs hourly.
- **`auto-paraplanner-release`**: any client with
  `workflow_state IN ('draftingSOA', 'amendingSOA')` and a stale
  `claimed_paraplanner_id` (per the threshold in §4.5; default 48h)
  has its claim cleared. The workflow state does not change; only the
  `claimed_paraplanner_id` and `claimed_at` columns reset. The
  paraplanner can voluntarily release at any time via a button in
  their portal (also clears the columns; no transition fires).

The default AR cadence is **10 months from CSA signing** (matches the
legacy default; the original plan said 12). Tenant-overridable in the
admin config (§10.5). The DocuSign webhook on the onboarding pack OR
the AR Pack is what writes `next_ar_due_date` —
`computeNextArDueDate(csaSignedAt, cadenceMonths)` in
`@advicelink/workflow` is the single computation site.

### 5.5 Manual Workflow Override

`confirmImplementation` (the "Confirm & Update Baseline" button on the
implementation page) has no in-app reverse — there is no "Reopen"
button. The only way to roll a client back from `waitingForAR` to
`implementingAdvice` is the **Manual Workflow Override** in the admin
page, which is audit-logged in `admin_audit_log` and gated to
`tenant_super_admin` / `platform_super_admin`.

### 5.6 Workflow visualisation

Every page that shows a client also shows a phase pill with the macro
phase name and the tooltip-listed micro state. The Workflow Maps admin
page (§6.27) renders a Mermaid-style diagram of the entire machine
with a heatmap of how many clients are in each state right now,
flagging dashed/optional branches (`flagInsuranceAmendment`,
`flagInsuranceAmendmentAR`, `selfServeARComplete`) distinctly.

---

## 6. Pages and portals

Every page is described below in this format:

> **Route** — purpose, allowed roles, key components, key data, key actions.

### 6.1 GA Portal — `/portal/clients`
Lead-gen kanban-style portal. Roles: `lead_gen`, `tenant_super_admin`,
`platform_super_admin`. Three columns: New Leads, Fact Finding, Ready to Hand
Off. Drag-and-drop triggers the matching workflow transition. Card actions:
Open Fact Find, Add File Note, Hand off, Mark Lost.

### 6.2 Adviser Portal — `/portal/adviser`
Default landing for `adviser`. Tabs: My Clients, Awaiting Review, AR Pipeline,
ROA / EO Pipeline. Each row shows client name, phase pill, last activity, next
action, days-in-state. Actions: Open Client, Lock Fact Find, Send to
Paraplanner, Review SOA Wizard.

### 6.3 Paraplanner Portal — `/portal/paraplanner`
Two queues: **Available** (clients in `awaitingParaplanner` for any team this
paraplanner is in / pool member of) and **Claimed** (`claimed_paraplanner_id =
me`). Each Claimed card shows progress through the SOA Wizard sections, days
since claim, and a Release button.

### 6.4 UF Support Portal — `/portal/uf-support`
Pre-advised work queue. Buckets: Fact Find QA Needed, Documents Outstanding,
Verification In Progress. Cards link straight into Fact Find or Document
Storage filtered to the relevant items.

### 6.5 AR Support Portal — `/portal/ar-support`
Post-advised work queue. Buckets: Implementation In Progress, Implementation
Stuck (>14 days), Servicing, AR Imminent (next 30 days), AR Overdue. Each card
launches the Implementation Checklist or jumps to AR.

### 6.6 AR Portal — `/portal/ar-adviser`
For AR advisers. Buckets: AR Due This Month, AR Wizard In Progress, ROA / EO
Wizard In Progress, Recently Completed. Action shortcuts: Start AR Wizard,
Start ROA / EO Wizard.

### 6.7 Import Workbench — `/portal/import-workbench`
For `legacy_import` users. A tabular workbench for staging imported records,
running normalisation rules, mapping legacy fields to v3 schema fields,
previewing before commit, and committing with full audit trail. Each row's
final commit creates a fully formed client in `legacy_imported` state.

### 6.8 Client Overview — `/clients/$id/overview`
Client cover page. Shows: contact card (avatar, name, age, marital status,
preferred contact), phase pill, assigned adviser/paraplanner/AR adviser,
upcoming meetings, last 5 audit log entries, latest 5 file notes, next AR
date, current SOA status, latest engagement letter date, key financial
summary tiles (net wealth, total super, total income, weekly retirement
target).

### 6.9 Strategy — `/clients/$id/strategy`
Strategy workspace where the adviser/paraplanner explore strategy options,
referencing live Fact Find data and toggling strategy components. Tabs:
Cashflow, Insurance, Super, Investment, Estate, Retirement. Each tab has
read-only summary tiles + free-text strategy notes that flow into the SOA.

### 6.10 Calendar — `/clients/$id/calendar`
Microsoft Graph + Google Calendar integration (see §9.5). Tabs: Upcoming,
Past, By Calendar. Actions: Schedule Meeting (creates an event in the
adviser's primary calendar with the client as attendee), Sync Now.

### 6.11 Fact Find — `/clients/$id/fact-find`
The full client Fact Find. Section side-nav: Personal, Employment, Financial,
Assets & Liabilities, Superannuation, Contributions, Insurance,
Beneficiaries, Goals, Risk Profile.

(Recommendations are deliberately NOT a Fact Find section — they are an
SOA Production output and live under `clients.soa_wizard_data`. The
mapping was corrected in WP-7.)

A `factFindLocked` flag toggles every input to read-only and shows a banner.
Once locked, the only way to edit is for an adviser to start a ROA / EO
Wizard run, which records the requested change and creates a "delta" against
the locked Fact Find.

Subsection field shapes are in §7.

### 6.12 SOA Wizard — `/clients/$id/soa-wizard`
The wizard that produces the SOA. Section side-nav (in display order):

1. Cover & Title
2. About Us & Authority
3. Your Goals
4. Your Current Position
5. Your Risk Profile
6. Strategy Recommendations
7. Insurance Recommendations
8. Super Recommendations
9. Investment Recommendations
10. Cashflow Modelling
11. Projections
12. Fees & Costs Disclosure
13. Implementation Plan
14. Authority to Proceed
15. Appendices

Each section has its own sub-page, autosave, and an "AI assist" button that
calls the AI prompt registered for that section (§10.4). Each section's data
becomes a top-level key on `clients.soa_wizard_data`. The SOA document is
rendered as DOCX from the same data via the document service (§8).

The SOA Wizard tab key, route slug, frontend folder (`features/soa-wizard/`),
and backend module (`services/soa-wizard/`) all share the canonical name to
avoid the legacy ambiguity between "advice" and "SOA".

### 6.13 ROA / EO Wizard — `/clients/$id/roa-eo-wizard`
The wizard that produces a Record of Advice or Engagement-Order letter for
in-flight changes after a SOA has been issued. Sub-pages:

1. Reason for Change
2. Affected Recommendations
3. Updated Strategy
4. Updated Projections (delta vs SOA)
5. Authority Update

Document type is selected at the top of the wizard: **ROA**, **EO Letter**,
or **AR Letter (in-flight)**. The same wizard renders different DOCX
templates based on the selected type. Tab key (`roaEoWizard`), route
(`/roa-eo-wizard`), folder (`features/roa-eo-wizard/`), and backend module
(`services/roa-eo-wizard/`) all share the canonical name.

### 6.14 AR Wizard — `/clients/$id/ar-wizard`
The Annual Review wizard. Sub-pages: Review Goals, Review Position, Review
Insurance, Review Super, Review Investments, Reasons for Change, Document.
Final step renders the AR Letter DOCX.

### 6.15 Implementation Checklist — `/clients/$id/implementation-checklist`
Driven by `clients.implementation_progress` (see §7.6). Default checklist
groups: Engagement, Insurance Applications, Insurance Underwriting, Super
Rollovers, Super Contributions, Investment Setup, Estate Documents,
Confirmations Sent. Each item: title, owner, due date, status, notes,
attached envelope (DocuSign), attached document. Bulk actions: assign owner,
nudge client, mark complete.

### 6.16 Reverse Fact Find — `/clients/$id/reverse-fact-find`
The reverse Fact Find used during AR. Mirror sections: Goals, Employment,
Income, Assets, Superannuation, Beneficiaries, Contributions, Risk Profile.
Pre-fills from current client state and lets the AR adviser confirm or update
each field.

### 6.17 Quick Quote — `/quick-quote`
Standalone tool that talks to OmniLife (§9.6). Inputs: age, gender, smoker,
sum insured, occupation. Output: indicative premiums per insurer. Saves to
`quick_quotes` table for future reference.

### 6.18 Projections — `/projections`
Standalone projection sandbox that uses the same engine as the SOA Wizard's
Projections section. Inputs: starting balance, contributions, returns,
inflation, retirement age, target income. Output: tabular and charted
projection. Persists to `projection_runs` table.

### 6.19 Envelopes — `/clients/$id/envelopes`
List of DocuSign envelopes for the client. Each row: envelope name, status,
sender, recipients, sent at, last action at. Actions: Open in DocuSign, Send
Reminder, Void.

### 6.20 Document Storage — `/clients/$id/documents`
List of DOCX (and any client-uploaded) files for this client, tagged by type
(SOA, ROA, EO Letter, AR Letter, Authority, ID, Statement, Other). Actions:
Upload, Download, Generate New (opens the SOA Wizard / ROA / EO Wizard / AR
Wizard depending on type), Delete (super-admin only, audit-logged), Share
Link (creates a 24-hour signed download URL).

### 6.21 File Notes — `/clients/$id/file-notes`
List of file notes. Each note: subject, body (rich text), author, timestamp,
tags. Auto-generated notes are flagged. The auto generator runs on
significant transitions (Fact Find lock, SOA presented, AR completed) — see
`createAutoFileNote` semantics in §7.

### 6.22 File Note (single) — `/clients/$id/file-note/$noteId`
Single-note view with versioned edits, attachments, tag editor, and PDF-style
print stylesheet (browser print, not server-rendered). The system does not
generate PDFs server-side.

### 6.23 Audit Log — `/clients/$id/audit-log`
Immutable, append-only event log for the client. Filters: actor, type, date
range. Each entry: actor, type, payload diff (JSONB), timestamp. Cannot be
deleted by anyone; super-admins can only export.

### 6.24 Admin Home — `/admin`
Tenant admin home with cards linking to Page Visibility, Required Fields, AI
Prompts, Insurance Settings, Projection Settings, Recommended Portfolios,
Alternative Portfolios, Brand Theme, Document Templates, Teams, Users,
Feature Flags, Document Maps, Page Maps, Workflow Maps, Run Tests.

### 6.25 Document Maps — `/admin/document-maps`
Visual map of every DOCX template, its placeholders, and which Fact Find /
SOA Wizard data fields feed each placeholder. Used to onboard new
paraplanners and to verify template integrity.

### 6.26 Page Maps — `/admin/page-maps`
Visual sitemap of every page, with role-access lights and last-rendered-by
data. Used for compliance reviews.

### 6.27 Workflow Maps — `/admin/workflow-maps`
Live diagram of the XState machine (§5) with current state counts and
transition counts (last 7/30/90 days).

### 6.28 Run Tests — `/admin/run-tests`
Triggers backend self-tests (data-integrity checks, document round-trips,
RLS sanity tests). Read-only for non-super-admins.

---

## 7. Data model

Postgres is the single source of truth. JSONB is used for fields whose shape
the UI controls (e.g. SOA Wizard sections), but every field that drives a
business rule, a workflow transition, or a document placeholder is **a
typed column** validated by Zod.

All tables have:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL REFERENCES tenants(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (touched by trigger)
- `created_by UUID REFERENCES users(id)`
- `updated_by UUID REFERENCES users(id)`
- RLS policy `using (tenant_id = current_setting('app.current_tenant_id')::uuid)`

### 7.1 `tenants`

```
id              uuid pk
slug            text unique
display_name    text
primary_domain  text
status          text  -- 'active' | 'suspended'
brand_bundle    jsonb -- see §10.7
feature_flags   jsonb -- map of feature_key -> bool
created_at      timestamptz
```

### 7.2 `users`

```
id                  uuid pk
tenant_id           uuid fk
firebase_uid        text unique
email               citext unique within tenant
display_name        text
role                text  -- the role catalogue from §4.1
default_team_id     uuid fk teams(id) nullable
calendar_provider   text  -- 'microsoft' | 'google' | null
calendar_sub_id     text  -- subscription id for incremental sync
deactivated_at      timestamptz nullable
```

### 7.3 `teams`

```
id              uuid pk
tenant_id       uuid fk
name            text
type            text -- 'marketing' | 'advisory' | 'paraplanner_pool'
brand_overrides jsonb -- optional team-level brand override
config          jsonb -- per-team config: page_visibility overrides,
                      -- ar_default_offset_days, paraplanner_pool_team_ids,
                      -- soa_wizard_section_overrides, etc.
licensee        jsonb -- AFSL holder details, ABN, address, logos
```

### 7.4 `team_memberships`

```
team_id   uuid fk
user_id   uuid fk
seat      text -- the user's seat in this team:
               -- 'lead_gen' | 'adviser' | 'paraplanner' | 'uf_support'
               -- | 'ar_support' | 'ar_adviser' | 'management'
primary   bool
PRIMARY KEY (team_id, user_id, seat)
```

A user can have multiple memberships across teams (e.g. AR Adviser on Team A
and Adviser on Team B). The `default_team_id` on `users` decides the landing
portal.

### 7.5 `clients`

```
id                          uuid pk
tenant_id                   uuid fk

-- workflow
workflow_state              text   -- the XState state id, e.g. 'draftingSOA'
workflow_phase              text   -- macro phase, denormalised for queries
state_changed_at            timestamptz

-- ownership
lead_gen_team_id            uuid fk teams(id) nullable
advisory_team_id            uuid fk teams(id) nullable
assigned_adviser_id         uuid fk users(id) nullable
assigned_ar_adviser_id      uuid fk users(id) nullable
claimed_paraplanner_id      uuid fk users(id) nullable
claimed_at                  timestamptz nullable

-- key dates
fact_find_locked_at         timestamptz nullable
soa_presented_at            timestamptz nullable
soa_accepted_at             timestamptz nullable
last_ar_completed_at        timestamptz nullable
next_ar_date                date nullable

-- structured fact-find data (typed columns where business-critical,
-- otherwise jsonb keyed exactly to the UI sections)
personal                    jsonb
employment                  jsonb
financial                   jsonb
assets                      jsonb  -- also stores standalone liabilities;
                                   --   row.assetValue=0 + amountOwing>0 = pure debt
superannuation              jsonb
contributions               jsonb
insurance                   jsonb
beneficiaries               jsonb
goals                       jsonb
risk_profile                jsonb
-- Three historical Fact Find columns were dropped:
--   * `recommendations`     (WP-7) — SOA Production output; lives under
--                                    `soa_wizard_data`.
--   * `partner_employment`  (WP-7 follow-up) — partner data is captured on
--                                              `personal.partner*`.
--   * `liabilities`         (WP-7 follow-up) — consolidated into `assets`.

-- wizard outputs
soa_wizard_data             jsonb  -- one key per SOA Wizard section (§6.12)
roa_eo_wizard_data          jsonb  -- one key per ROA / EO Wizard section (§6.13)
ar_wizard_data              jsonb  -- one key per AR Wizard section (§6.14)
reverse_fact_find_data      jsonb

-- progress
implementation_progress     jsonb

-- denormalised for portal queries
display_name                text generated always as (
                              coalesce(personal->>'firstName','')
                              || ' ' ||
                              coalesce(personal->>'surname','')) stored
```

#### 7.5.1 `personal` JSONB shape

```ts
{
  firstName, middleName, surname, maidenName,
  title,                 // 'Mr' | 'Mrs' | 'Ms' | 'Dr' | 'Prof'
  gender,                // 'Male' | 'Female' | 'Other' | 'Prefer not to say'
  dateOfBirth,           // ISO date
  mobile, email,
  homeAddress: { street, suburb, city, state, postcode, country },
  hasDifferentPostalAddress: bool,
  postalAddress: { street, suburb, city, state, postcode, country } | null,
  height,                // cm
  weight,                // kg
  bmi,                   // derived
  smokerStatus,          // 'YES' | 'NO' | 'FORMER'
  healthNotes,
  maritalStatus,         // 'Single' | 'Married' | 'De facto' | 'Divorced' | 'Separated' | 'Widowed'
  partnerName, partnerDateOfBirth, partnerIncomeAnnual,
  hasDependants: bool,
  dependants: [
    { id, firstName, surname, dateOfBirth }
  ],
  taxFileNumber,         // stored encrypted at rest, masked in UI
  qualification,
  nextOfKin, nextOfKinContact,
  hasClaimedOnInsurance: bool,
  insuranceClaim: { dateOfClaim, notes } | null,
  hasBeenBankrupt: bool,
  bankruptcy: { dateOfBankruptcy, notes } | null,
  hasWill: bool
}
```

#### 7.5.2 `employment` JSONB shape (primary client only; partner employer/occupation captured on `personal.partner*`)

```ts
{
  occupation,
  employer,
  employmentStatus,                  // 'Full-time' | 'Part-time' | 'Casual' | 'Self-employed' | ...
  percentageWorkInOffice,            // number 0-100
  workDuties,                        // free text
  annualLeaveAccruedHours,
  sickLeaveAccruedHours,
  longServiceLeaveAccruedHours,
  worksWithHazardousMaterials: bool,
  worksAtHeightsOver12m: bool
}
```

#### 7.5.3 `financial` (income) JSONB shape

```ts
{
  incomes: [
    {
      id,
      incomeType,                    // 'Salary' | 'Bonus' | 'Self-employed' | 'Investment' | 'Pension' | ...
      grossAnnual,
      sgEligible: bool,
      superGuaranteePercent,         // editable when sgEligible
      superGuaranteeDollars          // derived from gross * percent
    }
  ],
  totalIncomeAnnual,                 // derived
  totalSgAnnual                      // derived
}
```

#### 7.5.4 `assets` (and unified liabilities) JSONB shape

```ts
assets: {
  items: [
    {
      id,
      name,
      assetValue,                    // 0 for a standalone debt
      amountOwing,
      isPpor: bool,                  // principal place of residence
      // when amountOwing > 0:
      interestRate,
      repaymentAmount,
      repaymentFrequency,            // 'Weekly' | 'Fortnightly' | 'Monthly' | 'Annual'
      lender,
      loanTermYears,
      startDate
    }
  ],
  totalAssets,                       // derived; sum of items[].assetValue
  totalLiabilities                   // derived; sum of items[].amountOwing
}
```

Single Fact Find section in the UI ("Assets and Liabilities"), backed
by a single JSONB column. A row with `assetValue = 0` and
`amountOwing > 0` is a standalone debt (e.g. credit card, unsecured
personal loan). The dedicated `liabilities` column was retired in
WP-7 follow-up — projection, net wealth, and the SOA template all
read this unified list.

#### 7.5.5 `superannuation` JSONB shape (matches the current Fact Find UI exactly)

```ts
{
  currentFunds: [                     // max 10 funds enforced server-side
    {
      id,                             // uuid
      fundName,
      memberNumber,
      investmentOption,
      currentBalance,                 // number, 2dp
      notes                           // free text
    }
  ]
}
```

The legacy schema carried many additional fields (USI, ABN, fee breakdowns,
defensive percent, tax components, EBA details, etc.). v3 deliberately keeps
the live UI shape: **only the five fields above per fund**. Richer super-fund
metadata is supplied via the recommended portfolio / like-for-like portfolio
configuration (§10.6) when needed for analysis or document generation, not
on the client record itself.

#### 7.5.6 `contributions` JSONB shape

```ts
{
  totalSgAnnual,                      // derived from financial.incomes
  sgDestination,                      // fund id from superannuation.currentFunds
  sgFrequency,
  sgLastReceived,                     // ISO date
  items: [
    {
      id,
      type,                           // 'Salary Sacrifice' | 'Personal Concessional' | 'Non-concessional' | 'Spouse' | 'Government Co-contribution'
      amount,
      frequency,                      // 'Weekly' | 'Fortnightly' | 'Monthly' | 'Quarterly' | 'Annual'
      destination,                    // fund id
      lastReceived,
      noiSubmitted: bool              // notice of intent (concessional only)
    }
  ],
  totalConcessional,                  // derived
  totalNonConcessional                // derived
}
```

#### 7.5.7 `insurance` JSONB shape

```ts
{
  totalSuperPremium,                  // derived
  totalPersonalPremium,               // derived
  covers: [
    {
      id,
      coverType,                      // 'Life' | 'TPD' | 'Trauma' | 'IP' | 'Income Protection'
      coverAmount,                    // for non-IP covers
      monthlyBenefit,                 // for IP covers only
      waitingPeriod,                  // IP only
      benefitPeriod,                  // IP only
      definition,                     // TPD only ('Any Occ' | 'Own Occ')
      structure,                      // TPD only ('Standalone' | 'Linked')
      premium, premiumFrequency, annualPremium, // annualPremium derived
      payee,                          // 'Self' | 'Super'
      insurer,
      medicallyUnderwritten: bool,
      premiumType                     // 'Stepped' | 'Level' | 'Hybrid'
    }
  ]
}
```

#### 7.5.8 `beneficiaries` JSONB shape

```ts
{
  items: [
    {
      id,
      fundOrPolicy,                   // string (fund or policy reference)
      firstName, middleName, surname,
      dateOfBirth,
      percentage,                     // 0-100, sum per fund/policy must == 100
      bindingType,                    // 'Binding' | 'Non-binding'
      lapsingType                     // 'Lapsing' | 'Non-lapsing'
    }
  ]
}
```

#### 7.5.9 `goals` JSONB shape (matches the current 7-question UI)

```ts
{
  desiredRetirementAge,               // number
  desiredRetirementIncomeWeekly,      // number
  next12Months,                       // free text
  next1To5Years,                      // free text
  retirementPlan,                     // free text
  superLumpSum,                       // free text
  superImportance,                    // free text
  insuranceImportance,                // free text
  previousAdviser,                    // free text
  _locked: {                          // per-question manual lock to preserve adviser-edited copy
    [questionId: string]: bool
  }
}
```

#### 7.5.10 `risk_profile` JSONB shape

```ts
{
  superannuationCashOut,              // radio answer key
  investmentExperience,               // radio answer key
  superannuationReaction,             // radio answer key
  riskToleranceStyle,                 // radio answer key
  experienceLevel,                    // radio answer key
  riskScore,                          // number, derived
  riskProfile,                        // 'Defensive' | 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive', derived
  notes
}
```

#### 7.5.11 Recommendations are an SOA Production output, not a Fact Find section

Earlier drafts of this plan modelled recommendations as a 13th Fact
Find JSONB column. WP-7 corrected this: recommendations are produced
**from** the Fact Find by paraplanners and advisers during SOA /
ROA-EO production, not collected as part of fact gathering. They live
exclusively under `clients.soa_wizard_data` (and, for amendments,
`clients.roa_eo_wizard_data`); the canonical shape lands alongside
the SOA Wizard schemas in WP-8 and is roughly:

```ts
{
  rolloverStrategy:               { items: [{ id, rolloverType, fromFundId, toFundId, ... }] },
  recommendedInsurance:           { covers: [{ ...InsuranceCoverShape, recommendation, importance }] },
  amendmentsRecommendedInsurance: { covers: [...] }, // populated only via ROA / EO Wizard runs
  platformPortfolio:              { portfolioType, riskProfile, portfolioId },
  likeForLikePortfolio:           { fundName, investmentOption, fees: {...} },
  currentPortfolio:               { performanceRange, grossReturn, fees: {...}, derived: {...} },
  notes
}
```

The historical `clients.recommendations` column was dropped in
migration `0010_drop_clients_recommendations.sql`.

### 7.6 `clients.implementation_progress` JSONB shape

```ts
{
  groups: [
    {
      key,                // e.g. 'engagement'
      label,
      items: [
        {
          key, label,
          status,         // 'pending' | 'in_progress' | 'blocked' | 'complete' | 'na'
          ownerUserId,
          dueDate,
          notes,
          envelopeId,     // FK to envelopes table when applicable
          documentId      // FK to client_documents
        }
      ]
    }
  ]
}
```

A default checklist is seeded at SOA-accepted from the tenant's
`implementation_checklist_default` admin setting.

### 7.7 Other tables

```
audit_log                  -- immutable
  id, tenant_id, client_id, actor_id, type, payload jsonb, created_at

file_notes
  id, tenant_id, client_id, author_id, subject, body_html, body_text,
  tags text[], is_auto bool, source_event text, created_at, updated_at

client_documents
  id, tenant_id, client_id, document_type, filename, storage_key,
  mime_type, size_bytes, generated_from text,
  generated_run_id uuid, uploaded_by, created_at

documents_runs           -- one row per DOCX render
  id, tenant_id, client_id, document_type, source ('soa-wizard' | 'roa-eo-wizard' | 'ar-wizard' | 'manual'),
  template_version, input_snapshot jsonb, status, error_message,
  storage_key, requested_by, started_at, completed_at

envelopes                 -- DocuSign / Adobe Sign
  id, tenant_id, client_id, provider, provider_envelope_id,
  status, recipients jsonb, document_ids uuid[], sent_at, completed_at

workflow_events
  id, tenant_id, client_id, from_state, to_state, transition_name,
  actor_id, reason, created_at

calendar_events
  id, tenant_id, client_id, user_id, provider, provider_event_id,
  subject, start_at, end_at, attendees jsonb, raw jsonb

quick_quotes
  id, tenant_id, requested_by, inputs jsonb, results jsonb,
  client_id nullable, created_at

projection_runs
  id, tenant_id, requested_by, inputs jsonb, results jsonb,
  client_id nullable, created_at

ai_invocations             -- audit of every AI call
  id, tenant_id, client_id, user_id, prompt_key, model,
  input_tokens, output_tokens, cost_cents, latency_ms,
  redacted_input jsonb, redacted_output jsonb, created_at

esign_webhooks             -- raw provider webhook bodies for replay
```

### 7.8 Encryption and PII

- TFN, partner TFN, dependants' TFNs (if ever captured) are encrypted at rest
  using `pgcrypto` symmetric encryption with a per-tenant key managed by
  Doppler.
- Address fields are not encrypted but RLS-protected.
- All PII columns are listed in `data_classification.md` and the export tool
  uses that list.

---

## 8. Document generation (DOCX-only)

### 8.1 Output policy

The application produces **only `.docx` files**. There is no PDF rendering
pipeline anywhere in v3 — no Puppeteer, no headless Chromium, no
`html-to-docx`, no Pandoc. If a customer needs a PDF they convert from Word.

This is a deliberate constraint:
- The product's primary consumers (advisers, paraplanners, compliance staff,
  clients) need **editable** documents.
- Removing the PDF path eliminates the largest source of layout drift,
  template duplication, and Chrome-version flakiness from the legacy app.

### 8.2 Toolchain

- **`docxtemplater`** — primary engine. Templates are real `.docx` files
  authored in Word (or an open-source clone) with `{placeholder}` /
  `{#loops}{/loops}` / `{:image}` syntax.
- **`docx`** (the npm package) — used programmatically when the document
  contains structures that are awkward to template, e.g. dynamic-row-count
  tables of insurance covers, charts, or projection breakdowns. These are
  built as standalone `.docx` fragments and merged into the parent template
  using the `docxtemplater` `module-docxtemplater-docx-merger` extension.
- **`chartjs-node-canvas`** — renders chart PNGs that are inserted as images
  in the DOCX (charts cannot be live in Word, so a static image is the
  correct primitive).
- **`docx-merger`** — used for appending appendices.

There is no `libreoffice`, no `unoconv`, no PDF tooling installed on any
container.

### 8.3 Template store

Templates live in object storage at
`tenants/{tenant_id}/templates/{type}/{version}.docx` plus
`tenants/{tenant_id}/templates/{type}/manifest.json`. Each manifest declares:

```json
{
  "type": "soa",
  "version": "2026-05-01",
  "label": "Statement of Advice",
  "placeholders": [
    { "key": "client.firstName", "required": true, "source": "personal.firstName" },
    { "key": "soa.coverDate",     "required": true, "source": "soa_wizard_data.cover.date" },
    { "key": "soa.feeTable",      "required": true, "source": "computed:fee-disclosure" },
    ...
  ]
}
```

The Document Maps admin page (§6.25) consumes these manifests so paraplanners
can see exactly which Fact Find / SOA Wizard fields back each placeholder.

### 8.4 Document types

| Type key | Source feature | Template manifest |
|---|---|---|
| `fact-find` | Fact Find | `fact-find.manifest.json` |
| `soa` | SOA Wizard | `soa.manifest.json` |
| `roa` | ROA / EO Wizard (when type = ROA) | `roa.manifest.json` |
| `eo-letter` | ROA / EO Wizard (when type = EO Letter) | `eo-letter.manifest.json` |
| `ar-letter` | AR Wizard, or ROA / EO Wizard (when type = AR in-flight) | `ar-letter.manifest.json` |
| `engagement-letter` | Manual generate from Implementation Checklist | `engagement-letter.manifest.json` |
| `authority-to-proceed` | Manual / SOA Wizard final step | `authority-to-proceed.manifest.json` |
| `client-service-agreement` | Implementation Checklist | `client-service-agreement.manifest.json` |
| `disclosure` | Implementation Checklist | `disclosure.manifest.json` |
| `quick-quote` | Quick Quote tool | `quick-quote.manifest.json` |
| `projection-report` | Projections sandbox | `projection-report.manifest.json` |

(The "Wizard" naming is the in-app feature name; the document `type` keys
are the document genres. Keeping them separate prevents confusion: the
**ROA / EO Wizard** can produce three different document types depending on
the run's selected output.)

### 8.5 Render pipeline

```
   user clicks "Generate"
         │
         ▼
   POST /trpc/documents.render
         │
         ▼
   create documents_runs row, status='queued'
         │
         ▼
   enqueue { runId } on BullMQ 'documents' queue
         │
         ▼
   worker:
     1. load run, snapshot client + wizard data into run.input_snapshot
     2. resolve template + version + manifest
     3. validate snapshot against manifest (Zod schema generated from manifest)
     4. compute derived placeholders (fees, totals, projections, charts → PNG)
     5. render base template via docxtemplater
     6. render dynamic fragments via docx, merge in
     7. apply tenant brand bundle (header logo, footer, colours, fonts)
     8. write to S3 at tenants/{tenant_id}/clients/{client_id}/docs/{runId}.docx
     9. create client_documents row
    10. update documents_runs to status='complete'
         │
         ▼
   frontend polls /trpc/documents.runStatus or subscribes via WS
         │
         ▼
   download via signed S3 URL (15-min TTL)
```

### 8.6 Branding application

Branding is applied at render time, not at template authoring time:

- The template uses neutral placeholders (`{tenant.logoImage}`,
  `{tenant.licensee.name}`, `{tenant.licensee.afsl}`,
  `{theme.primaryColorHex}`).
- The render worker pulls the resolved brand bundle (tenant default,
  overridden by team — see §10.7) and supplies it as part of the rendering
  context.
- Section header/footer images live in S3 and are inserted via
  `docxtemplater` image module.

### 8.7 Charts

Three chart types are supported (Chart.js renders all of them):

- Asset allocation pie (recommended portfolio)
- Projection line chart (balance vs age)
- Insurance needs vs cover bar chart

Chart configs are JSON inputs to `chartjs-node-canvas`; outputs are PNGs at
2x DPI, inserted as inline images. The same `Chart.js` config drives the live
UI charts so visual parity is automatic.

### 8.8 Document version control

- Templates are versioned by date (`2026-05-01.docx`). Older versions remain
  accessible for re-rendering historic documents.
- The `documents_runs.template_version` records which template generated a
  given DOCX. A "Regenerate with current template" action on Document
  Storage queues a fresh run with the latest version while preserving the
  original.

### 8.9 Document QA

A nightly BullMQ job runs **golden-file tests** against every active
template:

1. Load a fixture client snapshot.
2. Render the DOCX.
3. Diff the rendered DOCX (after canonicalising XML and stripping volatile
   fields like timestamps and `revision`s) against a checked-in golden DOCX.
4. On mismatch, file an incident in the alerts queue with a colour-coded
   diff link.

Fixtures live in `apps/api/test/fixtures/document-snapshots/` and goldens in
`packages/document-goldens/`.

---

## 9. Integrations

### 9.1 Firebase Auth

Retained as the identity provider. Reasons: existing users, MFA support,
email-link sign-in, social providers, password reset, account recovery —
none of which we want to rebuild.

- The frontend uses the Firebase Web SDK to sign in and obtain an ID token.
- Every tRPC request sends `Authorization: Bearer <idToken>`.
- The API verifies tokens with the Firebase Admin SDK and resolves the
  `users` row by `firebase_uid`.
- The first time a user logs in, an admin must have pre-provisioned the
  `users` row with `firebase_uid = null`; the first verified login fills
  the `firebase_uid` and locks the email match.

### 9.2 Postgres (Railway)

Primary data store. A single Railway Postgres plugin per environment
(`production`, `staging`, `preview-*`). Migrations are managed by Drizzle
ORM, source-controlled in `packages/db/migrations/`. PITR is enabled with a
14-day retention window.

### 9.3 Object storage (AWS S3)

`ap-southeast-2`, one bucket per environment. Layout:

```
tenants/{tenant_id}/templates/{type}/{version}.docx
tenants/{tenant_id}/clients/{client_id}/docs/{runId}.docx
tenants/{tenant_id}/clients/{client_id}/uploads/{uuid}.{ext}
tenants/{tenant_id}/branding/{slug}.{ext}
```

Server-side encryption with KMS, default lifecycle: 365-day intelligent-tier
transition, 7-year retention, MFA-delete on the bucket itself.

### 9.4 Anthropic Claude

Used by:
- Fact Find Goals AI assist
- Insurance recommendation explanations
- AR Wizard "reasons for change" drafting
- File note generation from event payloads
- SOA Wizard per-section assist (see §10.4 for the prompt registry)

The integration lives in `packages/ai/`. All calls flow through a single
`callClaude(promptKey, inputs, context)` function which:

- Looks up the prompt template in the AI Prompt registry (§10.4) — never
  inlines prompts in feature code.
- Redacts PII from `inputs` according to the prompt's `redaction` rules.
- Records the invocation in `ai_invocations`.
- Enforces tenant-level monthly token budget; over-budget calls fail
  cleanly and surface a "Contact your tenant admin" message.

### 9.5 Calendar (Microsoft Graph + Google Calendar)

Two providers behind a `CalendarPort` interface in `packages/calendar/`. A
user picks one provider in their settings; the API stores OAuth refresh
tokens in `users.calendar_provider` + a separate encrypted `calendar_creds`
table.

Capabilities exposed:
- Create event with attendees, body, location.
- List upcoming/past events for a client (matched via attendee email or a
  bound `provider_event_id`).
- Incremental sync via subscription/webhook.

### 9.6 OmniLife

Used for insurance quoting in Quick Quote and for Recommended Insurance
real-pricing. Lives in `packages/insurance-quoting/omnilife/`, behind an
`InsuranceQuotePort` interface so additional quoting sources can be added
without touching feature code.

### 9.7 Lonsec

Used for portfolio research. Lives in `packages/research/lonsec/`. Read-only
catalogue API: list portfolios, fetch portfolio details, fetch fund-level
research notes. The Recommended Portfolios admin (§10.6) uses this to
populate dropdowns when adding a portfolio.

### 9.8 DocuSign

E-signature provider. Lives in `packages/esign/docusign/`. Capabilities:

- Create envelope from one or more DOCX files.
- Add tabs (signers, dates, initials) by either anchored placeholder text
  or absolute positions, depending on document type.
- Send envelope.
- Receive webhook events; the webhook handler verifies the signature using
  DocuSign Connect's HMAC, persists raw payloads in `esign_webhooks`, and
  emits an internal event consumed by the implementation checklist watcher.

A second provider, **Adobe Sign**, sits behind the same `EsignPort` so
tenants can pick which to use.

### 9.9 SendGrid

Transactional email. Templates managed in SendGrid; the API references
templates by template ID and supplies dynamic data. Reasons we don't roll
our own SMTP: deliverability, DKIM/DMARC management, bounce handling.

### 9.10 Sentry, PostHog, Pino, OpenTelemetry

- **Sentry** — error reporting, browser + node SDKs, source maps uploaded
  on deploy.
- **PostHog** — product analytics, feature flags, session replays
  (PII-masked per `data_classification.md`).
- **Pino** — structured logs, JSON line format, shipped to Better Stack.
- **OpenTelemetry** — traces from API + workers exported to Honeycomb.

### 9.11 Removed integrations (compared to legacy)

- **Excel Power Query data tap** — removed. There is **no** REST endpoint
  that exposes raw client tables for Power Query consumption. If a tenant
  needs reporting in Excel, the export tool produces a sanctioned `.xlsx`
  on demand from the same data, with the tenant admin's audit trail.
- **Puppeteer / headless Chromium** — removed (no PDF generation).
- **`html-to-docx`** — removed (replaced by native `docxtemplater`).
- **Pandoc / `htmlToDocxPandoc`** — removed.
- **Hard-coded super-admin email** — removed; super-admin status comes
  from `users.role = 'tenant_super_admin'` or `'platform_super_admin'`.

---

## 10. Admin and configuration surfaces

All admin pages live under `/admin` and require `tenant_super_admin` or
`platform_super_admin`. Every admin write produces an audit log entry on a
dedicated `admin_audit_log` table.

### 10.1 Page visibility — `/admin/page-visibility`

The page-access matrix in §4.3 is the **default**. A tenant super-admin
overrides per advisory team:

```ts
team.config.pageVisibilityOverrides = {
  // role -> page key -> bool
  paraplanner: {
    soaWizard: true,
    quickQuote: false
  }
}
```

The frontend resolves visibility as: default-for-role
→ tenant-level override → team-level override.

### 10.2 Required fields — `/admin/required-fields`

Per Fact Find section, a JSON config controls which fields are required
before a transition is allowed. Example:

```ts
{
  personal: {
    requiredFields: ['firstName', 'surname', 'dateOfBirth', 'email', 'mobile'],
    dependants: { requiredFields: ['firstName', 'surname', 'dateOfBirth'] }
  },
  superannuation: {
    currentFunds: {
      requiredFields: ['fundName', 'memberNumber', 'currentBalance']
    }
  },
  goals: { requiredFields: ['desiredRetirementAge', 'desiredRetirementIncomeWeekly'] }
}
```

Required-field configs are versioned; bumping a config can only be done by a
super-admin and produces an audit entry.

### 10.3 Workflow gating — `/admin/workflow-gates`

Per transition, declare which Fact Find required-field profile must pass
before the transition is allowed. Example:

```ts
{
  handOffToAdvice: {
    requiresFactFindProfile: 'minimal'
  },
  lockFactFind: {
    requiresFactFindProfile: 'pre-advice'
  },
  sendToParaplanner: {
    requiresFactFindProfile: 'pre-advice'
  }
}
```

### 10.4 AI prompts — `/admin/ai-prompts`

Every Claude-backed feature has a registered prompt. The registry is keyed
by `promptKey` (e.g. `factFindGoals`, `insuranceExplanation`,
`arWizardReasons`, `fileNoteGenerator`, `soaWizard.cover.assist`,
`soaWizard.strategyRecommendations.assist`, etc.). Each entry stores:

```ts
{
  promptKey,
  label,
  systemPrompt,                    // multi-line markdown
  userTemplate,                    // mustache-like with explicit placeholders
  inputSchema,                     // Zod-compatible JSON schema
  outputSchema,
  redaction: {
    fields: ['personal.taxFileNumber', 'personal.dateOfBirth'],
    mode: 'mask'                   // 'mask' | 'omit'
  },
  model,                           // e.g. 'claude-3.7-sonnet'
  temperature,
  maxTokens,
  costCapCentsPerCall,
  enabled
}
```

Tenant-level overrides allow each tenant to customise prompts (e.g. to bake
in their tone of voice) without touching code.

### 10.5 Insurance and projection settings

Both engines are **declarative JSON-driven** (the legacy approach worked and
is preserved):

#### `/admin/insurance-settings`
Edits the active `insurance-settings` document. Schema (truncated):

```ts
{
  needsAnalysis: {
    life:           { calculation: <expr>, inputs: [...] },
    tpd:            { calculation: <expr>, inputs: [...] },
    trauma:         { calculation: <expr>, inputs: [...] },
    incomeProtection: { calculation: <expr>, inputs: [...] }
  },
  defaults: {
    waitingPeriodDays: 30,
    benefitPeriodAge: 65
  }
}
```

Calculation expressions are restricted JavaScript evaluated in a sandboxed
`isolated-vm` context with a fixed allow-list of Math functions.

#### `/admin/projection-settings`
Edits the active `projection-settings` document — assumptions (inflation,
gross returns, fees, tax tiers) and the projection calculation graph. Same
sandboxed-eval model.

Both settings are versioned; SOA Wizard / ROA / EO Wizard / AR Wizard runs
record which settings version they used so old documents remain
reproducible.

### 10.6 Recommended portfolios — `/admin/portfolios`

Two sub-tabs:
- **Recommended portfolios** — the portfolios the firm offers as primary
  recommendations.
- **Alternative portfolios** — the like-for-like comparators.
- **Paraplanner pools** — a tenant-level configuration mapping advisory
  teams to one or more `paraplanner_pool` teams from which paraplanners
  may claim.

Each portfolio entry stores:

```ts
{
  id,
  name,
  type,                       // 'SMA' | 'Managed Fund' | 'Direct Equities'
  riskProfile,                // 'Defensive' | 'Conservative' | 'Balanced' | 'Growth' | 'Aggressive'
  platform,                   // 'HUB24' | 'Macquarie' | 'Netwealth' | ...
  fees: {
    adminFeeFixed,
    adminFeePercent,
    investmentFeePercent,
    icrPercent,
    platformFeeBands: [...]
  },
  historicalPerformance: { '1y': ..., '3y': ..., '5y': ..., '10y': ... },
  assetAllocation: [{ class, percent }],
  research: { lonsecFundCode, ratingDate, rating }
}
```

### 10.7 Brand theme — `/admin/branding`

The brand bundle (per tenant, optionally per advisory team):

```ts
{
  logos: {
    light: storageKey,
    dark:  storageKey,
    mono:  storageKey,
    favicon: storageKey
  },
  colours: {
    primary, primaryContrast,
    accent, accentContrast,
    surface, onSurface,
    success, warning, error
  },
  typography: {
    headingFont, bodyFont,        // via Google Fonts loader or self-hosted
    headingScale, bodyScale
  },
  documentChrome: {
    headerImage: storageKey,
    footerImage: storageKey,
    coverPageImage: storageKey,
    pageSize: 'A4'                // documents are A4 by default for AU
  },
  licensee: {
    name, abn, afsl,
    address: { street, suburb, state, postcode },
    website, email, phone,
    fsgUrl, ddoUrl
  },
  companyData: {                  // primary advice firm
    name, abn, address, website, email, phone, logo
  }
}
```

The web app injects the resolved colours/typography as CSS variables on
`<html>` so every Tailwind utility maps to the tenant theme. The DOCX
render worker reads the same bundle to apply document chrome.

### 10.8 Document templates — `/admin/document-templates`

Upload, version, label, and inspect placeholders for every DOCX template.
The page also previews placeholder coverage by overlaying the manifest on a
sample render.

### 10.9 Teams and users — `/admin/teams`, `/admin/users`

CRUD for teams and users. Bulk invites by CSV. Bulk role changes for
users. Promote/demote. Deactivate (soft-delete; preserves audit trail).

### 10.10 Feature flags — `/admin/feature-flags`

Per-tenant flag table; the frontend reads flags via PostHog plus a
fallback `tenant.feature_flags` JSONB read at login. Flags include things
like `enableLonsecLookup`, `enableAdobeSign`, `enableMobilePushNotifications`,
`enableExperimentalProjections`.

---

## 11. Architecture and folder structure

### 11.1 Repository layout (pnpm workspaces)

```
advicelink/
├─ apps/
│  ├─ api/                       # Fastify + tRPC server
│  ├─ web/                       # Vite + React 19 frontend
│  ├─ workers/                   # BullMQ workers (documents, ai, cron, esign)
│  └─ public-site/               # Marketing site (advicelink.org)
├─ packages/
│  ├─ db/                        # Drizzle schema, migrations, seed
│  ├─ schemas/                   # Zod schemas for every entity + DTOs
│  ├─ workflow/                  # XState client workflow machine + helpers
│  ├─ document-templates/        # Template authoring tooling, manifest schemas
│  ├─ document-renderer/         # docxtemplater pipeline, image insertion
│  ├─ chart-renderer/            # chartjs-node-canvas wrappers
│  ├─ ai/                        # Claude client, prompt registry runtime
│  ├─ esign/                     # EsignPort + DocuSign + Adobe Sign adapters
│  ├─ insurance-quoting/         # InsuranceQuotePort + OmniLife adapter
│  ├─ research/                  # Lonsec adapter
│  ├─ calendar/                  # CalendarPort + Microsoft + Google adapters
│  ├─ branding/                  # Brand bundle resolver, CSS-vars injector
│  ├─ projections-engine/        # Sandboxed evaluator + assumptions resolver
│  ├─ insurance-engine/          # Sandboxed needs-analysis evaluator
│  ├─ rbac/                      # canAccessClient, canAccessPage, etc.
│  ├─ analytics/                 # PostHog wrapper, event taxonomy
│  ├─ logger/                    # Pino + OTel
│  ├─ ui/                        # Shared design system (shadcn-derived)
│  └─ tsconfig/, eslint-config/  # Shared configs
└─ ops/
   ├─ railway/                   # Railway service manifests
   ├─ terraform/                 # AWS S3, KMS, Cloudflare zones
   └─ scripts/                   # one-off ops scripts (audit exports etc.)
```

No file in `apps/api/src` exceeds **600 lines**. No file in
`apps/web/src` exceeds **400 lines**. Lint rule enforces.

### 11.2 `apps/api` structure

```
apps/api/src/
├─ index.ts                       # boot Fastify, register plugins
├─ trpc/
│  ├─ context.ts                  # builds per-request context: user, tenant, db, services
│  ├─ middleware/
│  │  ├─ tenantAndRole.ts
│  │  └─ rateLimit.ts
│  └─ router.ts                   # mergeRouters of every feature router
├─ services/
│  ├─ clients/
│  │  ├─ index.ts                 # public API (createClient, getClient, listClients)
│  │  ├─ visibility.ts            # role-aware visible-clients query
│  │  ├─ paraplanner-claim.ts
│  │  └─ router.trpc.ts
│  ├─ fact-find/
│  │  ├─ index.ts
│  │  ├─ validators.ts            # Zod for each Fact Find section
│  │  └─ router.trpc.ts
│  ├─ soa-wizard/                 # was 'advice/' in legacy
│  │  ├─ index.ts
│  │  ├─ sections/                # one file per SOA Wizard section (§6.12)
│  │  │  ├─ cover.ts
│  │  │  ├─ aboutAuthority.ts
│  │  │  ├─ goals.ts
│  │  │  ├─ position.ts
│  │  │  ├─ riskProfile.ts
│  │  │  ├─ strategyRecommendations.ts
│  │  │  ├─ insuranceRecommendations.ts
│  │  │  ├─ superRecommendations.ts
│  │  │  ├─ investmentRecommendations.ts
│  │  │  ├─ cashflowModelling.ts
│  │  │  ├─ projections.ts
│  │  │  ├─ feesCosts.ts
│  │  │  ├─ implementationPlan.ts
│  │  │  ├─ authorityToProceed.ts
│  │  │  └─ appendices.ts
│  │  └─ router.trpc.ts
│  ├─ roa-eo-wizard/              # was 'amendments/' in legacy
│  │  ├─ index.ts
│  │  ├─ runs.ts                  # creating a run, selecting output type
│  │  ├─ sections/
│  │  │  ├─ reasonForChange.ts
│  │  │  ├─ affectedRecommendations.ts
│  │  │  ├─ updatedStrategy.ts
│  │  │  ├─ updatedProjections.ts
│  │  │  └─ authorityUpdate.ts
│  │  └─ router.trpc.ts
│  ├─ ar-wizard/
│  │  ├─ index.ts
│  │  ├─ sections/
│  │  └─ router.trpc.ts
│  ├─ implementation/
│  │  ├─ index.ts
│  │  ├─ defaults.ts
│  │  └─ router.trpc.ts
│  ├─ reverse-fact-find/
│  ├─ projections/
│  ├─ insurance/
│  ├─ documents/
│  │  ├─ index.ts
│  │  ├─ render.ts                # enqueues a render run
│  │  └─ router.trpc.ts
│  ├─ esign/
│  ├─ calendar/
│  ├─ file-notes/
│  ├─ audit/
│  ├─ admin/
│  │  ├─ tenants.ts
│  │  ├─ teams.ts
│  │  ├─ users.ts
│  │  ├─ pageVisibility.ts
│  │  ├─ requiredFields.ts
│  │  ├─ workflowGates.ts
│  │  ├─ aiPrompts.ts
│  │  ├─ insuranceSettings.ts
│  │  ├─ projectionSettings.ts
│  │  ├─ portfolios.ts
│  │  ├─ branding.ts
│  │  ├─ documentTemplates.ts
│  │  ├─ featureFlags.ts
│  │  └─ router.trpc.ts
│  ├─ legacy-import/
│  └─ storage/
│     └─ signedUrl.ts
├─ webhooks/
│  ├─ docusign.ts
│  ├─ adobeSign.ts
│  └─ calendar/
│     ├─ microsoftGraph.ts
│     └─ google.ts
└─ jobs/                          # BullMQ producers (counterpart to apps/workers)
   ├─ documents.ts
   ├─ ai.ts
   ├─ esign.ts
   └─ cron.ts
```

### 11.3 `apps/web` structure

```
apps/web/src/
├─ app/
│  ├─ root.tsx
│  ├─ providers/                 # auth, tenant, theme, query
│  └─ routes/                    # TanStack Router file-based routes
│     ├─ portal/
│     │  ├─ clients.tsx
│     │  ├─ adviser.tsx
│     │  ├─ paraplanner.tsx
│     │  ├─ uf-support.tsx
│     │  ├─ ar-support.tsx
│     │  ├─ ar-adviser.tsx
│     │  └─ import-workbench.tsx
│     ├─ clients/
│     │  └─ $clientId/
│     │     ├─ overview.tsx
│     │     ├─ strategy.tsx
│     │     ├─ calendar.tsx
│     │     ├─ fact-find/
│     │     │  └─ $section.tsx
│     │     ├─ soa-wizard/                 # canonical name
│     │     │  └─ $section.tsx
│     │     ├─ roa-eo-wizard/              # canonical name
│     │     │  └─ $section.tsx
│     │     ├─ ar-wizard/
│     │     │  └─ $section.tsx
│     │     ├─ implementation-checklist.tsx
│     │     ├─ reverse-fact-find/
│     │     │  └─ $section.tsx
│     │     ├─ envelopes.tsx
│     │     ├─ documents.tsx
│     │     ├─ file-notes.tsx
│     │     ├─ file-note/$noteId.tsx
│     │     └─ audit-log.tsx
│     ├─ quick-quote.tsx
│     ├─ projections.tsx
│     └─ admin/
│        ├─ index.tsx
│        ├─ page-visibility.tsx
│        ├─ required-fields.tsx
│        ├─ workflow-gates.tsx
│        ├─ ai-prompts.tsx
│        ├─ insurance-settings.tsx
│        ├─ projection-settings.tsx
│        ├─ portfolios.tsx
│        ├─ branding.tsx
│        ├─ document-templates.tsx
│        ├─ teams.tsx
│        ├─ users.tsx
│        ├─ feature-flags.tsx
│        ├─ document-maps.tsx
│        ├─ page-maps.tsx
│        ├─ workflow-maps.tsx
│        └─ run-tests.tsx
├─ features/
│  ├─ portals/
│  │  ├─ lead-gen/
│  │  ├─ adviser/
│  │  ├─ paraplanner/
│  │  ├─ uf-support/
│  │  ├─ ar-support/
│  │  └─ ar-adviser/
│  ├─ client-overview/
│  ├─ strategy/
│  ├─ calendar/
│  ├─ fact-find/
│  │  ├─ FactFind.tsx
│  │  └─ sections/
│  │     ├─ Personal.tsx
│  │     ├─ Employment.tsx
│  │     ├─ Financial.tsx
│  │     ├─ AssetsLiabilities.tsx
│  │     ├─ Superannuation.tsx
│  │     ├─ Contributions.tsx
│  │     ├─ Insurance.tsx
│  │     ├─ Beneficiaries.tsx
│  │     ├─ Goals.tsx
│  │     ├─ RiskProfile.tsx
│  │     └─ Recommendations.tsx
│  ├─ soa-wizard/                            # canonical name; was 'Advice'
│  │  ├─ SoaWizard.tsx                       # entrypoint
│  │  └─ sections/
│  │     ├─ Cover.tsx
│  │     ├─ AboutAuthority.tsx
│  │     ├─ Goals.tsx
│  │     ├─ Position.tsx
│  │     ├─ RiskProfile.tsx
│  │     ├─ StrategyRecommendations.tsx
│  │     ├─ InsuranceRecommendations.tsx
│  │     ├─ SuperRecommendations.tsx
│  │     ├─ InvestmentRecommendations.tsx
│  │     ├─ CashflowModelling.tsx
│  │     ├─ Projections.tsx
│  │     ├─ FeesCosts.tsx
│  │     ├─ ImplementationPlan.tsx
│  │     ├─ AuthorityToProceed.tsx
│  │     └─ Appendices.tsx
│  ├─ roa-eo-wizard/                         # canonical name; was 'Amendments'
│  │  ├─ RoaEoWizard.tsx                     # entrypoint
│  │  └─ sections/
│  │     ├─ ReasonForChange.tsx
│  │     ├─ AffectedRecommendations.tsx
│  │     ├─ UpdatedStrategy.tsx
│  │     ├─ UpdatedProjections.tsx
│  │     └─ AuthorityUpdate.tsx
│  ├─ ar-wizard/
│  │  ├─ ArWizard.tsx
│  │  └─ sections/...
│  ├─ implementation-checklist/
│  ├─ reverse-fact-find/
│  ├─ quick-quote/
│  ├─ projections/
│  ├─ envelopes/
│  ├─ documents/
│  ├─ file-notes/
│  ├─ audit-log/
│  ├─ import-workbench/
│  └─ admin/
├─ hooks/
├─ lib/
└─ styles/
```

### 11.4 `apps/workers` structure

```
apps/workers/src/
├─ index.ts                       # boots all queues with shared Redis
├─ queues/
│  ├─ documents/
│  │  ├─ processor.ts             # the render pipeline (§8.5)
│  │  └─ types.ts
│  ├─ ai/
│  │  ├─ processor.ts             # background Claude calls (long file note generation, etc.)
│  │  └─ types.ts
│  ├─ esign/
│  │  ├─ webhookProcessor.ts
│  │  └─ types.ts
│  ├─ cron/
│  │  ├─ autoArDue.ts
│  │  ├─ autoParaplannerRelease.ts
│  │  ├─ documentGoldenTests.ts
│  │  └─ retentionCleanup.ts
│  └─ virusScan/
│     └─ processor.ts             # ClamAV scan on uploaded client docs
└─ lib/
   ├─ tenantContext.ts            # sets app.current_tenant_id from job payload
   └─ logger.ts
```

### 11.5 Module rules

- **No cross-feature imports** between features in `apps/web/src/features/*`.
  Cross-cutting components live in `packages/ui`.
- **No raw SQL in feature code**. All DB access goes through
  `services/<feature>/repository.ts` which uses Drizzle.
- **No prompts inlined in feature code**. All Claude calls go through
  `packages/ai/registry`.
- **No environment-variable reads outside `apps/*/src/config/env.ts`**. Each
  app has a single Zod-validated env loader.
- **No string-typed workflow comparisons**. Use `packages/workflow` helpers
  (`isInPhase('drafting', client)`, `canTransition('lockFactFind', client, user)`).

### 11.6 Styling, design system, and design tokens

The visual language of v3 is defined once and reused everywhere. The
reference design is the lightweight admin-app aesthetic shown below: a soft
near-white surface, a quiet left sidebar with a small wordmark, generous
whitespace, large readable type, restrained accent colour for active and
selected states, and big white "card" canvases that hold the actual work
(tables, forms, wizards).

![Design reference — light, sidebar-led admin aesthetic](./assets/design-reference.png)

Specifically, the reference establishes:

- A **two-pane layout**: vertical sidebar on the left for primary
  navigation, a tall content canvas on the right.
- A **wordmark** in the sidebar header with one accented colour syllable
  (we will use the resolved tenant brand primary colour for the accent —
  see §10.7).
- **Quiet nav** — no icons in the primary nav, just text. Active item
  uses the brand primary colour; hover uses a near-transparent surface
  tint; everything else is neutral.
- **White cards on a near-white surface** for the main content area
  (`background = surface-muted`, `card = surface`, with a 1px hairline
  border and a very soft shadow).
- **Tables** with a checkbox column, generous row height, low-contrast
  zebra (only on hover/selection), and **header annotations** in a
  smaller, lighter weight (e.g. `Total pay (per annum)`, `Tax 20%`).
- **Selection state** uses a pale-blue tint on the row plus a filled
  brand-coloured checkbox.
- **Generous spacing** — base 4px grid, 8px row gutters in tables,
  24–32px padding inside cards.

#### 11.6.1 Three rules (non-negotiable)

These three rules are enforced by lint and reviewed in every PR:

1. **Create semantic components early.** Before any feature page is built,
   the corresponding semantic components must exist in `packages/ui`. A
   semantic component encodes a *meaning* (`<ClientCard>`, `<PhasePill>`,
   `<DataTable>`, `<FactFindFieldGroup>`, `<WizardStepHeader>`,
   `<EmptyState>`, `<RoleBadge>`) — not a layout primitive. Pages compose
   semantic components; they never reach for primitives directly.
2. **Never style directly inside pages.** Files under
   `apps/web/src/app/routes/**` and `apps/web/src/features/**` must contain
   no Tailwind utility classes for visual styling, no inline `style={}`, no
   `styled-components`, and no CSS Module class lists. Their only styling
   responsibility is **layout composition** via a small set of layout
   primitives (`<PageShell>`, `<Stack>`, `<Cluster>`, `<Grid>`, `<Inline>`)
   from `packages/ui`. All visual choices (colour, type, radius, shadow,
   spacing scale, motion) live inside semantic components.
3. **Use design tokens consistently.** All visual values — colour, type,
   spacing, radius, shadow, motion — are exposed as **design tokens** and
   only referenced through tokens. No raw hex colours in code. No raw
   pixel values in component code (only in the token file). Tokens are
   the single source of truth and they are themed per tenant.

#### 11.6.2 Token taxonomy

Tokens live in `packages/ui/src/tokens/` as plain TypeScript objects, then
emit:

- A CSS variable sheet injected into `:root` and `[data-theme="dark"]`.
- A `tailwind.config.ts` preset consumed by `apps/web` and Storybook.
- A typed token API (`tokens.color.brandPrimary`,
  `tokens.space.cardPadding`) usable from React/JS where Tailwind classes
  cannot reach (e.g. dynamic chart colours).

Token groups:

```
color
  brand
    primary, primaryHover, primaryPressed, primaryContrast
    accent,  accentHover,  accentPressed,  accentContrast
  surface
    base                 // page background, near-white   (#F7F8FA)
    raised               // card background               (#FFFFFF)
    sunken               // table-row hover, table footer (#F2F4F7)
    inverse              // dark surfaces (modals on dark background)
  border
    subtle               // hairlines on cards / tables   (#E5E7EB)
    strong               // emphasised dividers           (#D0D5DD)
    focus                // 2px focus ring colour
  text
    primary              // headlines, body               (#0F172A)
    secondary            // sublabels, header annotations (#475467)
    tertiary             // hints, placeholders           (#98A2B3)
    onBrand              // text on brand colour fills
    inverse              // text on inverse surfaces
  state
    success, successSurface
    warning, warningSurface
    danger,  dangerSurface
    info,    infoSurface
  selection
    rowBackground        // pale brand tint for selected table rows
    rowBorder

space        // 4px grid: 0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64
size         // semantic widths/heights: sidebar.width, navItem.height, table.rowHeight, card.maxWidth
radius       // none, sm=4, md=8, lg=12, xl=16, pill=9999
shadow       // none, hairline, soft, raised, overlay, focus
typography
  fontFamily   { sans, mono, display }   // default sans = Inter; tenant overridable
  fontWeight   { regular=400, medium=500, semibold=600, bold=700 }
  fontSize     { xs=12, sm=13, body=14, md=15, lg=17, xl=20, 2xl=24, 3xl=30, 4xl=36 }
  lineHeight   { tight=1.2, body=1.45, relaxed=1.6 }
  letterSpacing{ tight, normal, wide }
  scale        // composed text styles:
               //   display, h1, h2, h3, h4, body, bodyStrong,
               //   label, labelMuted, mono, tableHeader, tableHeaderAnnotation
motion
  duration     { instant=80ms, quick=150ms, base=220ms, slow=320ms }
  easing       { standard, emphasised, decelerate, accelerate }
zIndex         { base, sticky, dropdown, popover, modal, toast }
```

The reference image's "small lighter weight" header annotation maps to
`typography.scale.tableHeaderAnnotation`. The pale-blue selected row
maps to `color.selection.rowBackground`. The wordmark accent maps to
`color.brand.primary`.

#### 11.6.3 Component layering

Layered, lower layers cannot import from higher layers:

```
Layer 0 — Tokens                 packages/ui/src/tokens/*
Layer 1 — Primitives             packages/ui/src/primitives/*
   Box, Stack, Cluster, Grid, Inline, Spacer, VisuallyHidden
   (layout only — no opinions on colour/type)
Layer 2 — Atoms                  packages/ui/src/atoms/*
   Button, Input, Checkbox, Radio, Switch, Tag, Pill, Avatar,
   Icon, Spinner, Skeleton, Badge, Divider
   (consume tokens; no business meaning)
Layer 3 — Molecules              packages/ui/src/molecules/*
   FormField, FieldGroup, MenuItem, Toolbar, BreadcrumbBar, Tabs,
   DropdownMenu, Combobox, DatePicker, NumberField, MoneyField,
   PercentField, ToastItem
Layer 4 — Semantic components    packages/ui/src/semantic/*
   AppShell           // the two-pane layout
   SidebarNav         // wordmark + quiet nav, matches reference
   SidebarNavItem
   PageShell          // container + heading + actions slot
   Card               // raised surface with hairline + soft shadow
   DataTable          // checkbox column, header annotations, selection
   ColumnHeader       // supports primary + annotation
   PhasePill, RoleBadge, ClientCard, ClientAvatar
   WorkflowChip, WorkflowMap
   FactFindFieldGroup, FactFindSection, FactFindLockBanner
   WizardLayout, WizardStepHeader, WizardStepNav, WizardSectionShell
   AdviceFeeTable, ProjectionChart, AssetAllocationPie
   EmptyState, ErrorState, LoadingState
   PortalKanban, PortalKanbanColumn, PortalKanbanCard
Layer 5 — Feature compositions   apps/web/src/features/**
   No styling allowed. Compose layers 1+4 only.
Layer 6 — Routes                 apps/web/src/app/routes/**
   Pure routing + data loading + composition of feature components.
```

ESLint rules forbid:

- Importing from a higher layer in a lower layer.
- Importing primitives or atoms directly from feature/route files
  (must go through a semantic component).
- Tailwind utility classes in feature/route files (a custom rule scans
  `className` strings and fails on anything other than an empty string,
  a CSS-variable-only class, or one of the layout-primitive contract
  props translated to classes inside `packages/ui`).
- Hard-coded hex colours, raw `px`/`rem` values, and inline `style={}`
  outside `packages/ui/src/tokens` and `packages/ui/src/primitives`.

#### 11.6.4 Implementation choices

- **Tailwind CSS** as the styling engine, configured exclusively via the
  token preset emitted from `packages/ui/src/tokens`.
- **shadcn/ui** as the base for atoms/molecules where appropriate, but
  **always wrapped** by a semantic component before pages use them. The
  raw shadcn export is never imported by feature code.
- **CSS variables** for any value that must change at runtime per tenant
  (the brand colours, the chosen heading font). Emitted into `:root` by
  the `<BrandThemeProvider>` after resolving the brand bundle (§10.7).
- **`clsx` / `cva`** for variant management inside semantic components.
- **Framer Motion** for motion, with all durations and easings sourced
  from `tokens.motion`.
- **Icons**: `lucide-react`, wrapped by `<Icon name="..." />` from
  Layer 2 — feature code never imports `lucide-react` directly.

#### 11.6.5 Themability hooks

The brand bundle (§10.7) directly drives the following tokens:

- `color.brand.primary` (and its hover/pressed/contrast partners — derived
  via a colour-scale function, not configured by hand).
- `color.brand.accent` (same treatment).
- `color.selection.rowBackground` (derived: 8% mix of `brand.primary` over
  `surface.raised`).
- `typography.fontFamily.sans` and `typography.fontFamily.display` if the
  tenant supplies overrides.
- `radius.lg` (default 12, but tenants with a "softer" or "sharper"
  brand can opt into a different value via brand bundle).
- Document chrome maps cleanly into DOCX header/footer images and
  primary colour at render time (§8.6).

#### 11.6.6 Storybook is the source of visual truth

- Every Layer 1–4 component has Storybook stories, and every story has a
  Chromatic baseline.
- Visual regression in CI: any change to a story snapshot must be
  approved in the PR before merge.
- Stories are organised by layer, then by component, with controls for
  every variant.
- A "Theme switcher" toolbar in Storybook flips between three example
  tenant brand bundles so token-correctness is exercised continuously.

#### 11.6.7 Accessibility

Built into the token and component layers, not bolted on:

- Token contrast pairs are verified in CI (e.g.
  `text.primary on surface.raised`, `text.onBrand on brand.primary`)
  against WCAG 2.2 AA.
- Every interactive atom has visible focus (via `border.focus`),
  keyboard support, and an ARIA contract documented in its Storybook
  doc page.
- `<DataTable>` ships row-level keyboard nav, `aria-selected`, and a
  caption-and-summary out of the box.
- All form `<Field>` molecules pair label, hint, error, and required
  marker, and never rely on placeholder text as a label.

#### 11.6.8 What pages look like in practice

A page file in `apps/web/src/app/routes/` looks like this — pure
composition, zero styling:

```tsx
export const Route = createFileRoute('/portal/clients')({
  component: GAPortalPage,
})

function GAPortalPage() {
  const { data, isLoading } = trpc.clients.listForLeadGen.useQuery()

  return (
    <PageShell title="GA Portal">
      <PortalKanban>
        <PortalKanbanColumn title="New Leads"        items={data?.newLeads} />
        <PortalKanbanColumn title="Fact Finding"     items={data?.inProgress} />
        <PortalKanbanColumn title="Ready to Hand Off" items={data?.readyForHandoff} />
      </PortalKanban>
    </PageShell>
  )
}
```

All visual decisions — the soft surface, the card chrome, the column
spacing, the card hover state, the brand-coloured "ready" pill — live
inside `<PortalKanban>` / `<PortalKanbanColumn>` / `<PortalKanbanCard>`,
which themselves consume only tokens, primitives, and atoms.

---

## 12. Security and compliance posture

### 12.1 Authentication and session

- Firebase ID tokens, verified server-side via the Admin SDK on every
  request.
- Tokens have a 1-hour TTL; the web app rotates silently via the Firebase
  SDK.
- All cookies are `Secure`, `HttpOnly`, `SameSite=Strict`.
- Optional MFA enforced per tenant feature flag.

### 12.2 Authorisation

Three layers, every request:
1. tRPC `tenantAndRole` middleware checks role allow-list.
2. Service-layer `assertCanAccessClient(userId, clientId)` checks visibility
   per §4.4.
3. Postgres RLS hard-stops cross-tenant reads.

### 12.3 Secrets

- Doppler manages all secrets. Railway pulls from Doppler at deploy time.
- No secrets in `.env` files in the repo. Local dev uses
  `doppler run -- pnpm dev`.
- Anthropic, SendGrid, DocuSign, Adobe Sign, Microsoft, Google, Lonsec,
  OmniLife credentials all live in Doppler.
- Firebase service account JSON for the API lives in Doppler as a single
  encrypted blob.

### 12.4 Data classification and PII handling

`docs/data_classification.md` (companion file) lists every column and its
classification. Three classes: PUBLIC, INTERNAL, PII. PII columns:
- TFN, partner TFN — encrypted at rest with `pgcrypto`.
- DOB, email, phone, address — RLS only, no encryption.
- Health notes, insurance underwriting notes — RLS + masked in the AI
  redactor.
- Bank account numbers — never stored.

### 12.5 Audit and forensics

- `audit_log` is append-only; deletes are blocked by a Postgres `BEFORE
  DELETE` trigger.
- `admin_audit_log` is the same for admin actions.
- All login events (Firebase) are mirrored to `audit_log` via a backend
  webhook.
- Pino logs include `tenant_id`, `user_id`, `client_id`, `request_id`,
  `trace_id`, `span_id`.

### 12.6 Network and platform hardening

- Cloudflare WAF rules (OWASP core, custom rules for `/webhooks/*`).
- Rate limiting per tenant + per IP via Fastify rate-limit plugin backed by
  Redis.
- CORS allow-list per environment, no wildcards.
- Dependency scans via `pnpm audit` on every CI run; Snyk on `main`.
- Container scans via Railway's built-in image scanner.

### 12.7 Backups and disaster recovery

- Postgres PITR on Railway, 14-day window.
- Daily logical dump to a separate S3 bucket, 90-day retention.
- S3 bucket versioning + Object Lock for documents older than 24h.
- Quarterly DR drill: spin up a parallel environment from yesterday's
  backups and run the smoke-test suite.

### 12.8 Compliance (deferred details)

The full AFSL/RG-146 compliance posture, document retention schedules, and
breach-notification SOPs are deferred to a later phase per the brief. The
architecture above is compatible with a strict 7-year retention,
client-portability export, and right-to-erasure (subject to financial
record-keeping obligations).

---

## 13. Testing strategy

### 13.1 Unit

- Every `packages/*` module has 90%+ branch coverage.
- Every `services/*/index.ts` has unit tests with the database mocked at
  the repository layer.

### 13.2 Integration

- Every tRPC procedure has at least one happy path test and one
  authorisation-failure test, run against a real Postgres in CI.
- Every BullMQ processor has a test that enqueues a job and asserts the
  side effects (DB rows, S3 key existence — verified against MinIO in CI).

### 13.3 Contract

- The frontend's tRPC types are regenerated on each PR; a CI step compares
  generated types against the previous main commit and fails on
  unintentional breaking changes.

### 13.4 Workflow

- The XState machine has full coverage via `@xstate/test` model-based
  tests: every state, every transition.

### 13.5 RBAC fuzz

- A dedicated test suite enumerates every (role × page × client-state)
  triple and asserts the access decision matches the matrix in §4.3 plus
  the visibility rules in §4.4.

### 13.6 E2E

- Playwright suite, one project per portal role, run against a seeded
  preview environment.
- Includes a multi-step "lead → handoff → SOA Wizard → DOCX → DocuSign →
  implementation → AR → ROA / EO Wizard" critical path.

### 13.7 Visual regression

- Storybook + Chromatic across the design system.
- Document goldens (§8.9) for DOCX outputs.

### 13.8 Load

- k6 scripts in `ops/load/` covering portal listing, SOA Wizard autosave,
  and DOCX render queue saturation. Targets: p95 < 300ms for portal
  pages, p95 < 8s for DOCX render.

---

## 14. DevOps, hosting, and cutover plan

### 14.1 Environments

- `production` — `app.advicelink.com` + per-tenant subdomains.
- `staging` — `staging.advicelink.com`, mirrors production minus tenant
  data.
- `preview-*` — automatic per-PR Vercel preview + Railway plugin previews.

### 14.2 CI/CD

- GitHub Actions for everything.
- On PR: lint, typecheck, unit tests, integration tests, Storybook build,
  Chromatic, Playwright smoke.
- On merge to `main`: deploy `apps/api` and `apps/workers` to Railway
  staging, deploy `apps/web` to Vercel staging.
- Manual promotion to production via a "Promote" workflow.

### 14.3 Railway services

```
railway-project: advicelink-prod
  services:
    - api          (Fastify)        : 1 dyno, autoscale 1-4
    - workers      (BullMQ)         : 1 dyno, autoscale 1-3
    - postgres     (plugin)         : 4 vCPU, 16 GB, 100 GB disk
    - redis        (plugin)         : 1 GB
    - public-site  (Next.js, static) : 1 dyno
```

### 14.4 Cutover plan (replacing the existing app at the current domain)

**There are no production clients to migrate.** The existing app holds no
real client data that must move with the cutover. The v3 launch is therefore
a *fresh-start cutover*: the new app replaces the old one at the same domain,
but no data is migrated.

The plan is:

1. **Phase 0 — parallel run**.
   - Stand up `app.advicelink.com` for the new build behind a Cloudflare
     route that, by default, sends traffic to the legacy app.
   - Use a header-based or cookie-based override for v3 testers
     (`?v3=on` cookie) so internal users can use the new app without
     affecting customers.
   - Seed v3 with one tenant, the firm's brand bundle, the team
     structure, the user invites, the recommended portfolios, the AI
     prompts, the insurance/projection settings, and the document
     templates — all configured fresh through the admin surfaces (§10).
     No client records are created at this stage.

2. **Phase 1 — DNS cutover**.
   - Flip Cloudflare to send `app.advicelink.com` to v3 by default.
   - Keep legacy reachable at `legacy.advicelink.com` for a 30-day
     read-only fallback so internal users can reference any legacy
     records they want to recreate by hand.
   - Day-one user activity goes straight to v3: any new lead a Lead Gen
     user starts is captured in v3 from `newLead` onwards. Any in-flight
     client work in the legacy app is either completed in legacy before
     cutover or recreated by hand in v3 after cutover (the firm decides
     per client).

3. **Phase 2 — decommission**.
   - After 30 days with no rollback events and a clean audit, decommission
     legacy infra. Final read-only export of legacy is archived in S3
     with Object Lock for the firm's chosen retention period (default
     7 years per AU financial-advice record-keeping norms).

The Import Workbench (§6.7) and the `legacy_import` role remain in the v3
codebase. They are not used for the v1 cutover, but they're available for
future scenarios — for example, a new tenant joining the platform from
another CRM, or this tenant later deciding to bring in archived clients
from the legacy system in bulk.

### 14.5 Rollback

- Cloudflare flag flip restores legacy in <2 minutes during Phase 1.
- Because no v3 → legacy data sync exists, rolling back during Phase 1
  means any v3-only client work created after cutover is preserved in v3
  but not visible in legacy. Internal SOP for the cutover window is to
  treat v3 as the authoritative store from minute one.

---

## 15. Mobile strategy — PWA vs native

### 15.1 Recommendation

**Build a PWA first, defer native.**

Reasons:

- The product is a CRM. The dominant interaction is keyboard-and-mouse
  data entry (Fact Find, SOA Wizard, ROA / EO Wizard). Touch-first patterns
  are secondary.
- A PWA gives us:
  - Add-to-home-screen.
  - Offline read of recently-viewed clients (via TanStack Query
    persisted cache + service-worker shell caching).
  - Push notifications (web push on Android + macOS Safari; iOS Safari
    16.4+ supports it after add-to-home-screen).
- Native apps would duplicate every form for marginal gain. We can revisit
  later if user telemetry shows >25% mobile usage on data-entry pages.

### 15.2 PWA scope (v3 launch)

- `manifest.json` with full icon set, theme colour from the resolved tenant
  brand bundle.
- Service worker with:
  - App-shell precaching.
  - Stale-while-revalidate for tRPC GET responses, capped at recent
    clients.
  - Background sync queue for autosave POSTs that fail offline.
- Push notifications for: SOA review request, AR due, paraplanner claim
  request, DocuSign envelope completed.
- Camera capture for ID/document upload via `<input type="file"
  capture>` plus an in-app cropper.

### 15.3 Native deferral checklist

If we later decide to build a native app, the candidate triggers are:

- Apple Wallet integration for client business cards.
- Biometric quick-unlock for advisers in the field.
- Calendar integration that writes locally (avoiding round-trip to Graph).
- Sustained mobile traffic >25% on the primary work pages.

---

## 16. Deferred / open items

These are explicitly deferred from v3 launch:

- Full compliance regime (AFSL doc retention schedules,
  breach-notification SOPs, formal DPIA). Architecture is compatible.
- Native mobile apps (per §15).
- White-label public landing pages per tenant (only the in-app portal is
  branded at launch; the marketing site `advicelink.org` stays
  Advicelink-branded).
- A third quoting source beyond OmniLife (the `InsuranceQuotePort` is
  ready for it).
- Reporting cube / data warehouse beyond the export tool. (The previous
  Excel Power Query data tap is intentionally **not** being reintroduced.)
- Open API for third-party developers.
- Multi-region failover (single region — `ap-southeast-2` — at launch).

---

## 17. Definition of done

A feature is "done" when:

1. Zod schema in `packages/schemas` covers the inputs and outputs.
2. tRPC procedure exists with role allow-list, integration test, and
   authorisation-failure test.
3. Frontend feature lives under `apps/web/src/features/<canonical-name>/`
   with the canonical naming applied to file, route, tab key, label, and
   backend module.
4. Workflow transitions (if any) live in `packages/workflow` and have
   `@xstate/test` coverage.
5. Documents (if any) have a manifest, a versioned template, and a golden
   file.
6. Audit log entries are emitted on all writes.
7. PostHog events are emitted for the canonical user actions (defined in
   `packages/analytics/eventTaxonomy.ts`).
8. Storybook stories exist for every new component, with Chromatic
   baselines.
9. Playwright smoke covers the happy path for the persona who uses the
   feature.
10. Documentation in `docs/features/<feature>.md` mirrors the user-facing
    behaviour.

---

## 18. Quick-start checklist for the build team

In dependency order, these are the first 14 work packages. Each is sized
to roughly 2-4 weeks for a small focused team.

1. **Foundations** — repo, pnpm workspaces, CI, env loader, logger,
   Sentry, PostHog wiring, Doppler.
2. **DB + RLS** — Drizzle, base tables (`tenants`, `users`, `teams`,
   `team_memberships`, `audit_log`, `admin_audit_log`), RLS policies,
   migrations runner.
3. **Auth + tRPC skeleton** — Firebase verify middleware, tenant
   resolution, role allow-list middleware, base routers.
4. **Branding + theme** — brand bundle resolver, CSS-vars injector,
   tenant subdomain support, login screen.
5. **Workflow package** — XState machine, transition guards, model-based
   tests.
6. **Fact Find** — tables, Zod schemas (matching the UI exactly,
   including the 5-field Superannuation), service, tRPC, frontend.
7. **Clients & Portals** — `clients` table, visibility queries, six
   portals (excluding Import Workbench).
8. **SOA Wizard** — section data store, autosave, AI assist, the 15
   sections.
9. **Document renderer + SOA template** — manifest, version,
   docxtemplater pipeline, charts, golden test, Document Maps admin.
10. **DocuSign + Implementation Checklist** — `EsignPort`, envelope
    creation, webhook handler, default checklist seed, UI.
11. **ROA / EO Wizard + AR Wizard** — services, sections, document
    types, manifests, golden tests.
12. **Reverse Fact Find + AR cron** — tables, UI, `auto-ar-due` worker.
13. **Calendar + Quick Quote + Projections** — adapters, sandboxes, UI.
14. **Tenant onboarding configuration** — admin surfaces hardening, brand
    bundle import, document-template authoring tooling, the seed-tenant
    runbook, and the `?v3=on` cookie override used during the cutover
    parallel-run window.

(The Import Workbench is **not** on the critical path for v1 launch —
no clients require migration. It can be built post-launch as a Phase B
work package, or whenever a tenant first needs bulk import.)

After these 14 packages plus end-to-end hardening (E2E, load, security
review), v3 is ready for the cutover described in §14.4.

---

## 19. Build-time appendix

This appendix exists so the build team has every domain-level decision
already made in writing. It closes the gaps that §1–18 left implicit.

Notes:
- Where a default involves AU-legislated values (tax brackets, contribution
  caps, preservation age, Centrelink income test), the value is captured
  for the **2025–26** financial year. These live in
  `packages/projections-engine/src/legislatedRates/2025-26.ts` and are
  bumped each financial year by a tenant super-admin via a versioned
  settings document; old projection runs remain reproducible.
- "Required" fields below are the *engine* requirements (without them the
  feature cannot run). The tenant admin layer (§10.2) can layer additional
  required-field rules per workflow gate.

### 19.1 SOA Wizard — section schemas

Every SOA Wizard section's data lives under
`clients.soa_wizard_data.<sectionKey>`. Each section is a plain object;
nested arrays are allowed but not nested objects more than two levels
deep. Fields prefixed `_` are wizard meta (not document content).

#### 19.1.1 `cover`
```ts
{
  documentTitle,                       // default: "Statement of Advice"
  preparedFor,                         // derived from personal.firstName + surname (and partner)
  preparedForPartner: bool,            // include partner on cover
  preparedBy,                          // adviser display name
  authorisedRepresentativeNumber,      // from team licensee config
  preparationDate,                     // ISO date, default today
  validUntilDate,                      // default preparationDate + 30 days
  coverImageOverride: storageKey | null
}
```
AI assist: none.

#### 19.1.2 `aboutAuthority`
```ts
{
  scopeOfAdvice,                       // free text, AI-assist enabled
  excludedFromAdvice,                  // free text
  basisOfAdvice,                       // 'comprehensive' | 'limited' | 'scaled'
  feeForServiceModel,                  // 'fixed' | 'asset-based' | 'hybrid'
  authorityStatement,                  // long-form templated default with merge tokens
  acknowledgementOfRisks               // free text
}
```

#### 19.1.3 `goals`
Mirrors `clients.goals` (§7.5.9), plus:
```ts
{
  prioritisation: [                    // adviser-ordered top 3-5 goals
    { goalKey, priority, narrative }
  ],
  agreedReviewCadence                  // 'annual' | 'semi-annual' | 'quarterly'
}
```
AI assist: enrich `narrative` from the raw goal answer (`promptKey: soaWizard.goals.assist`).

#### 19.1.4 `position`
Snapshot of current position. Auto-populated from Fact Find on first open
and re-pullable with a "Refresh from Fact Find" button:
```ts
{
  household: {
    netWealth,                         // derived from assets.totalAssets - assets.totalLiabilities
    totalSuper,                        // sum of superannuation.currentFunds.currentBalance
    totalIncomeAnnual,                 // from financial.totalIncomeAnnual + partnerIncomeAnnual
    totalSgAnnual,                     // from contributions.totalSgAnnual
    weeklyExpensesEstimate             // optional adviser entry, defaults null
  },
  riskProfileLabel,                    // mirrors risk_profile.riskProfile
  insuranceSummary: { totalSumInsuredLife, totalSumInsuredTpd, totalIpMonthlyBenefit, totalAnnualPremium },
  observations                         // adviser commentary, AI-assist enabled
}
```

#### 19.1.5 `riskProfile`
```ts
{
  recommendedProfile,                  // typically equals client's measured profile but can be overridden
  rationaleIfOverridden,               // required when recommendedProfile != measured
  reviewWindowYears,                   // default 3
  notes
}
```

#### 19.1.6 `strategyRecommendations`
```ts
{
  themes: [                            // each theme produces a "Strategy" subheading in the SOA
    {
      id,
      title,                           // e.g. "Consolidate Superannuation"
      summary,                         // one-sentence outcome
      rationale,                       // multi-paragraph, AI-assist
      benefits: [string],
      considerations: [string],
      alternativesConsidered: [string]
    }
  ]
}
```
AI assist: `soaWizard.strategyRecommendations.assist` populates rationale/benefits/considerations from theme title plus position snapshot.

#### 19.1.7 `insuranceRecommendations`
```ts
{
  context,                              // free text, why insurance now
  needsAnalysisVersionId,               // FK to insurance-settings version used
  perCover: [
    {
      coverType,                        // 'Life' | 'TPD' | 'Trauma' | 'IP'
      currentCover,                     // from insurance.covers (matched by type)
      calculatedNeed,                   // engine output (§19.7)
      recommendedCover,                 // adviser-final number
      recommendedStructure,             // 'Inside Super' | 'Outside Super' | 'Hybrid'
      recommendedDefinition,            // TPD only
      recommendedWaitingPeriod,         // IP only
      recommendedBenefitPeriod,         // IP only
      recommendedPremiumType,           // 'Stepped' | 'Level' | 'Hybrid'
      providerShortlist: [{ insurer, indicativePremium, source: 'omnilife' | 'manual' }],
      preferredProvider,
      rationale,                        // AI-assist
      alternatives                      // free text
    }
  ]
}
```

#### 19.1.8 `superRecommendations`
```ts
{
  recommendation,                       // 'Retain current' | 'Consolidate' | 'Switch' | 'Open new'
  fromFundIds: [string],                // ids from superannuation.currentFunds
  toFundId,                             // id of recommended portfolio (§10.6)
  contributionStrategy: {
    salaryPackagedAmountAnnual,
    personalConcessionalAmountAnnual,
    nonConcessionalAmountAnnual,
    spouseContribution,
    coContributionTarget
  },
  rolloverNotes,
  rationale,                            // AI-assist
  feeComparison: {                      // derived
    currentTotalFeesPercent,
    recommendedTotalFeesPercent,
    annualSavingsAtCurrentBalance
  }
}
```

#### 19.1.9 `investmentRecommendations`
```ts
{
  outsideSuperRecommendation,            // 'No action' | 'Open' | 'Switch' | 'Top up'
  preferredPlatformId,                   // FK to recommended portfolio
  preferredPortfolioRiskProfile,
  initialInvestmentAmount,
  ongoingContribution: { amount, frequency },
  esgPreferences,
  rationale
}
```

#### 19.1.10 `cashflowModelling`
```ts
{
  baselineYearlyExpenses,
  surplusBeforeStrategy,                 // derived
  surplusAfterStrategy,                  // derived
  budgetAdjustments: [
    { category, currentAmount, proposedAmount, frequency }
  ],
  notes
}
```

#### 19.1.11 `projections`
Snapshot of the projection run pinned to the SOA:
```ts
{
  projectionRunId,                       // FK to projection_runs
  scenarios: ['baseline', 'recommended'],
  startAge,
  retirementAge,
  endAge,                                // default 95
  assumptions: {
    cpiPercent, returnsPercent, feesPercent,
    superTaxConcessional, drawdownStrategy
  },
  outputSummary: {
    balanceAtRetirement,
    balanceAtAge90,
    yearsCoveredAtTargetIncome
  }
}
```
The full year-by-year matrix lives on `projection_runs.results`; the
SOA's projections section quotes summary numbers and embeds the chart.

#### 19.1.12 `feesCosts`
```ts
{
  initialAdviceFee: { amount, gstApplicable: bool },
  ongoingAdviceFee: { amount, frequency, gstApplicable: bool },
  implementationFee: { amount },
  productFees: [                          // derived from recommended portfolio
    { feeName, amountOrPercent, basis }
  ],
  insurancePremiumsAnnualised,            // derived from insuranceRecommendations
  totalFirstYearCost,                     // derived
  totalOngoingCostPerYear,                // derived
  feesDisclosureStatement                 // long-form templated default
}
```

#### 19.1.13 `implementationPlan`
```ts
{
  steps: [
    {
      stepNumber,
      title,
      ownerRole,                          // 'client' | 'adviser' | 'ar_support' | 'paraplanner'
      estimatedTimeline,                  // free text e.g. "Within 2 weeks"
      dependsOn: [stepNumber]
    }
  ]
}
```

#### 19.1.14 `authorityToProceed`
```ts
{
  consents: [
    { id, label, defaultChecked: bool, required: bool }
  ],
  signatureBlocks: [
    { role: 'client' | 'partner' | 'adviser', signed: bool, signedDate }
  ],
  paymentAuthorities: [
    { type, account, amount, frequency }
  ]
}
```

#### 19.1.15 `appendices`
```ts
{
  attachedDocuments: [
    { documentType, label, storageKey }   // FSG, PDS references etc.
  ],
  glossary: [{ term, definition }],
  notes
}
```

### 19.2 ROA / EO Wizard — section schemas

`clients.roa_eo_wizard_data` is keyed by **run** (a client may have many),
not by client:

```ts
{
  runs: [
    {
      runId,
      runStartedAt,
      outputType,                        // 'roa' | 'eo-letter' | 'ar-letter'
      reasonForChange: { ... },
      affectedRecommendations: { ... },
      updatedStrategy: { ... },
      updatedProjections: { ... },
      authorityUpdate: { ... },
      finalisedAt: timestamp | null,
      documentRunId                      // FK to documents_runs once rendered
    }
  ]
}
```

#### 19.2.1 `reasonForChange`
```ts
{
  triggerEvent,                          // 'client-request' | 'market-driven' | 'rebalance' | 'legislative' | 'product-change' | 'insurance-update' | 'other'
  triggerNarrative,                      // free text
  appliesAsOfDate,
  scope                                  // 'minor' | 'material'
}
```

#### 19.2.2 `affectedRecommendations`
```ts
{
  affected: [
    {
      area,                              // 'super' | 'investment' | 'insurance' | 'cashflow' | 'estate'
      previousState,                     // copied from prior SOA / ROA at run start
      newState,
      delta                              // free text
    }
  ]
}
```

#### 19.2.3 `updatedStrategy`
Same shape as `soaWizard.strategyRecommendations`, but only themes that
have changed.

#### 19.2.4 `updatedProjections`
```ts
{
  baselineProjectionRunId,               // the projection cited in the latest SOA / prior ROA
  newProjectionRunId,                    // freshly run with updated inputs
  deltaSummary: {
    balanceAtRetirementDelta,
    balanceAtAge90Delta,
    yearsCoveredDelta
  }
}
```

#### 19.2.5 `authorityUpdate`
```ts
{
  consents: [{ id, label, required }],
  signatureBlocks: [{ role, signed, signedDate }]
}
```

### 19.3 AR Wizard — section schemas

`clients.ar_wizard_data` is also keyed by **run**:

```ts
{
  runs: [
    {
      runId,
      runStartedAt,
      reviewGoals: { ... },
      reviewPosition: { ... },
      reviewInsurance: { ... },
      reviewSuper: { ... },
      reviewInvestments: { ... },
      reasonsForChange: { ... },
      document: { ... },
      finalisedAt: timestamp | null,
      documentRunId
    }
  ]
}
```

#### 19.3.1 `reviewGoals`
```ts
{
  reverseFactFindRefreshedAt,
  goalsStillCurrent: bool,
  changedGoals: [{ goalKey, previous, current }],
  newGoals: [string],
  retiredGoals: [string]
}
```

#### 19.3.2 `reviewPosition`, `reviewInsurance`, `reviewSuper`, `reviewInvestments`
All share this shape:
```ts
{
  snapshotPrevious,                       // pulled from latest finalised SOA / ROA / AR
  snapshotCurrent,                        // pulled from current Fact Find / Reverse Fact Find
  changes: [{ field, previous, current, materiality: 'minor' | 'material' }],
  observation                             // adviser commentary
}
```

#### 19.3.3 `reasonsForChange`
Same shape as `roaEoWizard.reasonForChange`, list-of-N where N can be 0
(no changes — purely a confirmation review).

#### 19.3.4 `document`
```ts
{
  letterTone,                             // 'standard' | 'formal' | 'warm'
  closingNote,
  attachments: [{ documentType, label, storageKey }]
}
```

### 19.4 Document placeholder maps

Every DOCX template's manifest (§8.3) lists every placeholder with a
`source`. Source paths use this notation:

- `client.<path>` — fields on `clients` row.
- `personal.<path>` — alias for `client.personal.<path>`.
- `tenant.<path>` — fields from the resolved tenant brand bundle.
- `licensee.<path>` — fields from the team's `licensee` config.
- `companyData.<path>` — primary advice firm data from brand bundle.
- `adviser.<path>` — assigned adviser's user record.
- `soaWizard.<sectionKey>.<path>` — keyed under `clients.soa_wizard_data`.
- `roaEoWizard.<runIdContext>.<path>` — current run.
- `arWizard.<runIdContext>.<path>` — current run.
- `computed:<calculatorKey>` — value from a registered server-side
  calculator (`packages/document-renderer/src/computed/`). E.g.
  `computed:fee-disclosure-table`,
  `computed:projection-summary-numbers`,
  `computed:insurance-recommendation-table`.
- `chart:<chartKey>` — PNG produced by `chart-renderer`. E.g.
  `chart:asset-allocation-pie`, `chart:projection-line`.
- `image:<storageKey-template>` — image asset resolved at render time.

For loops, the manifest declares `loopSource` and the inner placeholders
are scoped to the iteration variable.

#### 19.4.1 `fact-find` template

```
{tenant.companyData.logoImage}
{personal.firstName} {personal.surname}
{personal.dateOfBirth}
{personal.email}, {personal.mobile}
{personal.homeAddress.street}, {personal.homeAddress.suburb} {personal.homeAddress.state} {personal.homeAddress.postcode}
{personal.maritalStatus}
{personal.partnerName} (loop conditional on maritalStatus in Married/De facto)

  loop personal.dependants:
    {firstName} {surname} — {dateOfBirth}

  loop financial.incomes:
    {incomeType} — ${grossAnnual} {sgEligibleLabel}

  loop assets.items:
    {name} — ${assetValue} (Owing ${amountOwing}) — {lender or '-'}

  loop superannuation.currentFunds:
    {fundName} — Member {memberNumber} — {investmentOption} — ${currentBalance}

  loop insurance.covers:
    {coverType} — ${coverAmount or monthlyBenefit} — {insurer} — ${annualPremium}/yr

  loop beneficiaries.items:
    {fundOrPolicy}: {firstName} {surname} {percentage}% ({bindingType}, {lapsingType})

{goals.next12Months}
{goals.next1To5Years}
{goals.retirementPlan}
{risk_profile.riskProfile} (score {risk_profile.riskScore})

{tenant.licensee.name} | AFSL {tenant.licensee.afsl} | {tenant.licensee.address.lineOne}
```

#### 19.4.2 `soa` template

```
HEADER & FOOTER
  {tenant.documentChrome.headerImage}
  {tenant.documentChrome.footerImage}
  Page {pageNumber} of {pageCount}

COVER
  {soaWizard.cover.documentTitle}
  Prepared for: {soaWizard.cover.preparedFor}
  Prepared by: {soaWizard.cover.preparedBy}, AR# {soaWizard.cover.authorisedRepresentativeNumber}
  Preparation date: {soaWizard.cover.preparationDate}
  Valid until: {soaWizard.cover.validUntilDate}
  {tenant.documentChrome.coverPageImage}

ABOUT US & AUTHORITY
  {tenant.companyData.name}
  {soaWizard.aboutAuthority.scopeOfAdvice}
  {soaWizard.aboutAuthority.excludedFromAdvice}
  {soaWizard.aboutAuthority.basisOfAdvice}
  {soaWizard.aboutAuthority.feeForServiceModel}
  {soaWizard.aboutAuthority.authorityStatement}
  {soaWizard.aboutAuthority.acknowledgementOfRisks}

YOUR GOALS
  loop soaWizard.goals.prioritisation:
    Priority {priority}: {goalKey} — {narrative}
  Agreed review cadence: {soaWizard.goals.agreedReviewCadence}

YOUR CURRENT POSITION
  Net wealth: ${soaWizard.position.household.netWealth}
  Total super: ${soaWizard.position.household.totalSuper}
  Total annual income: ${soaWizard.position.household.totalIncomeAnnual}
  Risk profile: {soaWizard.position.riskProfileLabel}
  Insurance summary table: {computed:position-insurance-summary}
  Observations: {soaWizard.position.observations}

YOUR RISK PROFILE
  Recommended profile: {soaWizard.riskProfile.recommendedProfile}
  Rationale: {soaWizard.riskProfile.rationaleIfOverridden or '-'}
  Review window: {soaWizard.riskProfile.reviewWindowYears} years

STRATEGY RECOMMENDATIONS
  loop soaWizard.strategyRecommendations.themes:
    Heading: {title}
    {summary}
    {rationale}
    Benefits: loop benefits: - {.}
    Considerations: loop considerations: - {.}
    Alternatives considered: loop alternativesConsidered: - {.}

INSURANCE RECOMMENDATIONS
  {soaWizard.insuranceRecommendations.context}
  Recommended cover table: {computed:insurance-recommendation-table}
  Per-cover narrative loop:
    {coverType} — recommended ${recommendedCover}
    {rationale}

SUPER RECOMMENDATIONS
  Action: {soaWizard.superRecommendations.recommendation}
  Consolidating from: loop fromFundIds: - {fundLookup(.).fundName}
  Recommended fund: {fundLookup(soaWizard.superRecommendations.toFundId).name}
  Contribution strategy: {computed:contribution-table}
  Fee comparison: {computed:fee-comparison-table}
  Rationale: {rationale}

INVESTMENT RECOMMENDATIONS
  {soaWizard.investmentRecommendations.outsideSuperRecommendation}
  Initial: ${soaWizard.investmentRecommendations.initialInvestmentAmount}
  Ongoing: ${soaWizard.investmentRecommendations.ongoingContribution.amount} {ongoingContribution.frequency}
  Asset allocation chart: {chart:asset-allocation-pie}

CASHFLOW MODELLING
  Surplus before: ${soaWizard.cashflowModelling.surplusBeforeStrategy}
  Surplus after: ${soaWizard.cashflowModelling.surplusAfterStrategy}
  Adjustments: {computed:budget-adjustments-table}

PROJECTIONS
  Projection chart: {chart:projection-line}
  Summary: {computed:projection-summary-numbers}
  Assumptions: {computed:projection-assumptions-block}

FEES & COSTS
  Fees disclosure table: {computed:fee-disclosure-table}
  {soaWizard.feesCosts.feesDisclosureStatement}
  Total first-year cost: ${soaWizard.feesCosts.totalFirstYearCost}
  Total ongoing cost per year: ${soaWizard.feesCosts.totalOngoingCostPerYear}

IMPLEMENTATION PLAN
  loop soaWizard.implementationPlan.steps:
    Step {stepNumber}: {title} — {ownerRole} — {estimatedTimeline}

AUTHORITY TO PROCEED
  loop soaWizard.authorityToProceed.consents:
    [{checkboxRendering(defaultChecked)}] {label}
  Signature block: client {{clientSignature}} {personal.firstName} {personal.surname} {{clientDate}}
  Signature block: partner (conditional) {{partnerSignature}} {{partnerDate}}
  Signature block: adviser {{adviserSignature}} {adviser.displayName} {{adviserDate}}

APPENDICES
  loop soaWizard.appendices.attachedDocuments:
    {label}
  Glossary loop: {term} — {definition}

  {tenant.licensee.name} | AFSL {tenant.licensee.afsl}
```

#### 19.4.3 `roa` template

Inherits `soa`'s header/footer. Body sections drawn from
`roaEoWizard.<runId>`:

```
COVER
  Title: "Record of Advice"
  Prepared for: {personal.firstName} {personal.surname}
  Prepared on: {currentRun.runStartedAt}
  Original SOA dated: {computed:latest-soa-date}

REASON FOR CHANGE
  Trigger: {currentRun.reasonForChange.triggerEvent}
  Narrative: {currentRun.reasonForChange.triggerNarrative}
  Effective: {currentRun.reasonForChange.appliesAsOfDate}

WHAT'S CHANGING
  loop currentRun.affectedRecommendations.affected:
    Area: {area}
    Previously: {previousState}
    Now: {newState}
    Why: {delta}

UPDATED STRATEGY
  loop currentRun.updatedStrategy.themes:
    {title} — {summary} — {rationale}

UPDATED PROJECTIONS
  Delta at retirement: ${currentRun.updatedProjections.deltaSummary.balanceAtRetirementDelta}
  Delta at age 90: ${currentRun.updatedProjections.deltaSummary.balanceAtAge90Delta}
  Years covered delta: {yearsCoveredDelta}
  Chart: {chart:projection-line-delta}

AUTHORITY UPDATE
  loop currentRun.authorityUpdate.consents:
    [{checkboxRendering(defaultChecked)}] {label}
  Signatures: {{clientSignature}} {{clientDate}} (client), {{adviserSignature}} {{adviserDate}} (adviser)
```

#### 19.4.4 `eo-letter` template

Same content domain as `roa` but in business-letter form. Anchored
placeholders for letterhead, salutation, body paragraphs, sign-off block.

```
{tenant.documentChrome.letterheadImage}
{currentRun.runStartedAt}

{personal.firstName} {personal.surname}
{personal.homeAddress.street}
{personal.homeAddress.suburb} {personal.homeAddress.state} {personal.homeAddress.postcode}

Dear {personal.firstName},

I am writing to confirm a change to your engagement with {tenant.companyData.name}…

Body paragraphs:
- Trigger: {currentRun.reasonForChange.triggerEvent}
- Narrative: {currentRun.reasonForChange.triggerNarrative}
- Affected areas (table): {computed:affected-areas-table}
- Updated fees (if applicable): {computed:fee-delta-block}

Yours sincerely,
{adviser.displayName}
Authorised Representative #{soaWizard.cover.authorisedRepresentativeNumber}
{tenant.licensee.name} (AFSL {tenant.licensee.afsl})
{{clientSignature}} {{clientDate}}
{{adviserSignature}} {{adviserDate}}
```

#### 19.4.5 `ar-letter` template

Used by both AR Wizard and ROA / EO Wizard runs producing an in-flight AR.

```
{tenant.documentChrome.letterheadImage}
{computed:ar-issue-date}

Dear {personal.firstName},

This is your Annual Review for the period ending {computed:ar-period-end}.

GOALS UPDATE
  loop currentRun.reviewGoals.changedGoals: was {previous}; now {current}
  New goals: loop newGoals: - {.}
  Retired goals: loop retiredGoals: - {.}

POSITION SNAPSHOT
  {computed:ar-position-snapshot-table}

INSURANCE
  {computed:ar-insurance-table}

SUPER
  {computed:ar-super-table}

INVESTMENTS
  {computed:ar-investment-table}

PROJECTIONS
  {chart:projection-line-ar}

REASONS FOR CHANGE
  loop currentRun.reasonsForChange:
    {triggerEvent}: {triggerNarrative}

{currentRun.document.closingNote}

Yours sincerely,
{adviser.displayName}
{{clientSignature}} {{clientDate}}
{{adviserSignature}} {{adviserDate}}
```

#### 19.4.6 `engagement-letter` template

Generated from the Implementation Checklist or from the SOA Wizard's
"Authority to Proceed" final step.

```
{tenant.documentChrome.letterheadImage}
{currentDate}

Engagement of {tenant.companyData.name} by {personal.firstName} {personal.surname}

Scope: {soaWizard.aboutAuthority.scopeOfAdvice}
Fees:
  Initial: ${soaWizard.feesCosts.initialAdviceFee.amount}
  Ongoing: ${soaWizard.feesCosts.ongoingAdviceFee.amount} {ongoingAdviceFee.frequency}
  Implementation: ${soaWizard.feesCosts.implementationFee.amount}
Term: 12 months, renewing annually unless terminated

Acknowledgements: loop soaWizard.authorityToProceed.consents

Signatures: {{clientSignature}} {{clientDate}} (client), {{adviserSignature}} {{adviserDate}} (adviser)
```

#### 19.4.7 `authority-to-proceed` template

A short two-pager extracted from the SOA's Authority section, used
when the client wants the authority block separately:

```
Authority to Proceed
{personal.firstName} {personal.surname}
SOA dated {soaWizard.cover.preparationDate}

Consents: loop soaWizard.authorityToProceed.consents
Payment authorities: loop soaWizard.authorityToProceed.paymentAuthorities

Signatures: {{clientSignature}} {{clientDate}} (client), {{partnerSignature}} {{partnerDate}} (partner if applicable), {{adviserSignature}} {{adviserDate}} (adviser)
```

#### 19.4.8 `client-service-agreement` template

```
Client Service Agreement
{personal.firstName} {personal.surname} and {tenant.companyData.name}

Services included: loop {computed:csa-services-included}
Fee structure: {computed:fee-disclosure-table}
Review cadence: {soaWizard.goals.agreedReviewCadence}
Term: 12 months auto-renewing
Termination: 14 days written notice from either party
Privacy: {tenant.licensee.privacyPolicyUrl}

Signatures: {{clientSignature}} {{clientDate}} (client), {{adviserSignature}} {{adviserDate}} (adviser)
```

#### 19.4.9 `disclosure` template

Generic disclosure document used during implementation:

```
Disclosure of {disclosure.subject}
{disclosure.body}
Issued by {tenant.licensee.name} (AFSL {tenant.licensee.afsl})
{currentDate}
```

`disclosure.subject` and `disclosure.body` are passed in by the
implementation-checklist UI when the disclosure item is created.

#### 19.4.10 `quick-quote` template

```
Indicative Insurance Quote
For: {quickQuote.inputs.firstName} {quickQuote.inputs.surname or 'Prospect'}
Inputs: age {age}, gender {gender}, smoker {smokerStatus},
        sum insured ${sumInsured}, occupation "{occupation}"

Indicative premiums: loop quickQuote.results.byInsurer:
  {insurer} — ${monthlyPremium}/month — {productCode}

Disclaimer:
  These figures are indicative and based on
  information provided. Final premiums are subject to
  underwriting. Issued by {tenant.licensee.name} (AFSL {tenant.licensee.afsl}).
{currentDate}
```

#### 19.4.11 `projection-report` template

```
Projection Report
Inputs:
  Starting balance: ${projection.inputs.startingBalance}
  Contributions: ${projection.inputs.contributionsAnnual}/yr
  Returns: {projection.inputs.returnsPercent}%
  Inflation: {projection.inputs.cpiPercent}%
  Retirement age: {projection.inputs.retirementAge}
  Target income: ${projection.inputs.targetIncomeAnnual}/yr (today's dollars)

Year-by-year table: {computed:projection-year-table}
Chart: {chart:projection-line}

Summary:
  Balance at retirement: ${projection.results.balanceAtRetirement}
  Balance at age 90: ${projection.results.balanceAtAge90}
  Years covered at target: {projection.results.yearsCoveredAtTargetIncome}

Assumptions and disclaimer: {computed:projection-assumptions-block}
```

---

### 19.5 Projection engine — specification

The engine produces a year-by-year projection of household financial
position, by primary client (and partner if present), in nominal AUD.

#### 19.5.1 Inputs

```ts
{
  asAtDate,                              // ISO date; defaults to today
  primary: {
    dateOfBirth, gender,
    employmentStatus, grossIncomeAnnual, sgPercent,
    superFunds: [{ id, balance, feesPercent, returnsAdjustmentPercent? }],
    contributionsAnnual: { concessional, nonConcessional, employerSG },
    riskProfile                          // drives default returns
  },
  partner: { ... } | null,
  retirement: {
    primaryRetirementAge,                // from goals.desiredRetirementAge
    partnerRetirementAge,
    targetIncomeAnnualWeekly,            // from goals.desiredRetirementIncomeWeekly
    targetIncomeMode                     // 'today-dollars' | 'future-dollars'
  },
  outsideSuper: {
    investmentBalance, contributionsAnnual, returnsPercent, feesPercent
  },
  ownHomeOnly: bool,                     // affects age-pension assets test
  endAge,                                // default 95
  scenarios: ['baseline', 'recommended']
}
```

#### 19.5.2 Assumptions (default profile, editable per tenant in §10.5)

```
cpiPercent              = 2.5
wageGrowthPercent       = 3.0
returnsByRiskProfile = {
  Defensive    : 4.0,
  Conservative : 5.0,
  Balanced     : 6.5,
  Growth       : 7.5,
  Aggressive   : 8.5
}
feesPercentDefault      = 0.85         // total fees on super
drawdownStrategy        = 'minimum'    // 'minimum' | 'target-income' | 'level-income'
agePension              = 'modelled'   // 'modelled' | 'ignored'
```

`returnsAdjustmentPercent` on a fund overrides the risk-profile default for
that fund only.

#### 19.5.3 Legislated rates (FY2025-26)

```ts
const RATES_2025_26 = {
  superGuaranteePercent: 12.0,
  concessionalContributionCap: 30000,
  nonConcessionalContributionCap: 120000,
  bringForwardCap3y: 360000,
  preservationAge: { '<1960-07-01': 55, '1960-07-01..1961-06-30': 56, ..., '>=1964-07-01': 60 },
  superTaxConcessional: 0.15,
  superExitTaxFreeAfterAge60: true,
  taxBracketsResident: [
    { upTo: 18200,   rate: 0.0,  base: 0 },
    { upTo: 45000,   rate: 0.16, base: 0 },
    { upTo: 135000,  rate: 0.30, base: 4288 },
    { upTo: 190000,  rate: 0.37, base: 31288 },
    { upTo: Infinity, rate: 0.45, base: 51638 }
  ],
  medicareLevyPercent: 2.0,
  agePension: {
    qualifyingAge: 67,
    rateSinglePerFortnight: 1144.40,
    rateCouplePerFortnight: 1725.20,
    incomeTestThresholdSingle: 218,
    incomeTestThresholdCouple: 380,
    incomeTestTaperPerDollar: 0.50,
    assetsTestThresholdHomeownerSingle: 314000,
    assetsTestThresholdHomeownerCouple: 470000,
    assetsTestThresholdNonHomeownerSingle: 566000,
    assetsTestThresholdNonHomeownerCouple: 722000,
    assetsTestTaperPerThousandPerFortnight: 3.00
  }
};
```

These constants live in
`packages/projections-engine/src/legislatedRates/2025-26.ts` and are
re-exported by year. A new financial year is added by creating
`2026-27.ts` and bumping the active version pointer in tenant settings;
existing `projection_runs` retain a frozen reference to the version they
used.

#### 19.5.4 Per-year computation

The engine produces, for each year from `asAtDate.year` to
`asAtDate.year + (endAge - currentAge)`, a row:

```ts
{
  year,
  primaryAge, partnerAge,
  phase,                                  // 'accumulation' | 'preserved' | 'retirement'
  super: {
    primary: { openingBalance, contributionsConcessional, contributionsNonConcessional, employerSG, taxOnConcessional, returns, fees, drawdown, closingBalance },
    partner: { ... }
  },
  outsideSuper: { openingBalance, contributions, returns, fees, drawdown, closingBalance },
  income: {
    employmentPrimary, employmentPartner,
    superDrawdown,
    investmentDrawdown,
    agePension,
    totalGross, totalAfterTax
  },
  expenses: targetIncomeAnnualForYear,
  surplusOrShortfall
}
```

Order of operations within each year:
1. Apply wage growth to gross incomes (if still working).
2. Apply employer SG to super at the year's SG percent.
3. Apply concessional/non-concessional contributions, capped by legislated
   caps; excess flagged in the row.
4. Apply contributions tax (15%) on concessional contributions.
5. Apply returns to opening balance + half of net contributions
   (mid-year convention).
6. Apply fees on average balance.
7. If retired, compute drawdown per `drawdownStrategy`:
   - `minimum`: legislated minimum based on age (4% under 65, 5% 65–74,
     6% 75–79, 7% 80–84, 9% 85–89, 11% 90–94, 14% 95+).
   - `target-income`: draw enough to top up combined household income to
     `targetIncomeAnnualForYear` after tax and age pension; if super is
     exhausted, flow to `outsideSuper`.
   - `level-income`: indexed `targetIncomeAnnualForYear`, with shortfall
     surfaced rather than over-drawn.
8. Compute personal income tax using resident bracket table.
9. Compute Medicare levy.
10. Compute age pension (if `agePension = 'modelled'`) using the lower of
    income test and assets test outcomes; both clients' modelled
    income/assets feed in.

#### 19.5.5 Output summary

```ts
{
  scenario,                               // 'baseline' | 'recommended'
  startYear, endYear,
  rows: [...],                            // per §19.5.4
  summary: {
    balanceAtRetirementPrimary,
    balanceAtRetirementPartner,
    balanceAtAge90,
    yearsCoveredAtTargetIncome,
    firstShortfallYear: number | null,
    weightedReturnAchieved
  },
  assumptionsVersionId,
  legislatedRatesVersion
}
```

#### 19.5.6 Sandboxing

The declarative `calculation` expressions referenced in §10.5 are
evaluated using `isolated-vm` with:
- 50 ms time budget per expression.
- 32 MB memory budget per evaluation.
- An allow-listed global of `{ Math, currentRow, prevRow, inputs,
  assumptions, rates }`.
- No I/O, no `require`, no top-level side effects.

#### 19.5.7 Parity rule

The same engine code path drives:
- The Projections page (§6.18).
- The SOA Wizard `projections` section (§6.12).
- The ROA / EO Wizard `updatedProjections` section.
- The AR Wizard `reviewSuper`/`reviewInvestments` snapshots.
- The DOCX `projection-report` and SOA/ROA/AR projection placeholders.

There is no second implementation; the document renderer calls the same
engine with the same inputs and embeds the output via `computed:` and
`chart:` placeholders.

### 19.6 Insurance needs-analysis — defaults

Defaults that ship in `insurance-settings/default.json`. Tenants can
customise in §10.5; runs that produced finalised SOAs are pinned to the
version used.

```json
{
  "version": "2025-08-01",
  "needsAnalysis": {
    "life": {
      "calculation": "outstandingDebts + (annualIncomeReplacementYears * grossAnnualIncome) + immediateNeeds + childrenEducationCosts - existingLiquidAssets - existingLifeCover",
      "inputs": {
        "outstandingDebts":          "sum(assets.items.amountOwing)",
        "grossAnnualIncome":         "financial.totalIncomeAnnual",
        "annualIncomeReplacementYears": 10,
        "immediateNeeds":            15000,
        "childrenEducationCosts":    "personal.dependants.length * 80000",
        "existingLiquidAssets":      "max(0, sum(assets.items where !isPpor).assetValue * 0.5)",
        "existingLifeCover":         "sum(insurance.covers where coverType=='Life').coverAmount"
      }
    },

    "tpd": {
      "calculation": "outstandingDebts + (modificationsAndCare) + (annualIncomeReplacementYears * grossAnnualIncome * 0.7) - existingLiquidAssets - existingTpdCover",
      "inputs": {
        "outstandingDebts":          "sum(assets.items.amountOwing)",
        "modificationsAndCare":      250000,
        "grossAnnualIncome":         "financial.totalIncomeAnnual",
        "annualIncomeReplacementYears": 8,
        "existingLiquidAssets":      "max(0, sum(assets.items where !isPpor).assetValue * 0.5)",
        "existingTpdCover":          "sum(insurance.covers where coverType=='TPD').coverAmount"
      }
    },

    "trauma": {
      "calculation": "lumpSumDefault - existingTraumaCover",
      "inputs": {
        "lumpSumDefault":            "max(150000, grossAnnualIncome * 1.5)",
        "grossAnnualIncome":         "financial.totalIncomeAnnual",
        "existingTraumaCover":       "sum(insurance.covers where coverType=='Trauma').coverAmount"
      }
    },

    "incomeProtection": {
      "calculation": "min(grossMonthlyIncome * legislatedReplacementCap, monthlyIncome * 0.75) - existingIpMonthlyBenefit",
      "inputs": {
        "grossMonthlyIncome":        "financial.totalIncomeAnnual / 12",
        "monthlyIncome":             "financial.totalIncomeAnnual / 12",
        "legislatedReplacementCap":  0.70,
        "existingIpMonthlyBenefit":  "sum(insurance.covers where coverType=='IP').monthlyBenefit"
      }
    }
  },

  "defaults": {
    "ipWaitingPeriodDays": 30,
    "ipBenefitPeriodAge":  65,
    "tpdDefinitionDefault": "Any Occupation",
    "tpdStructureDefault":  "Standalone",
    "premiumTypeDefault":   "Stepped",
    "preferredStructure": {
      "Life": "Inside Super",
      "TPD":  "Inside Super",
      "IP":   "Outside Super",
      "Trauma": "Outside Super"
    }
  }
}
```

Calculation expressions evaluate in the same sandbox as projections
(§19.5.6), with `client.*` available as the input context.

### 19.7 Risk-profile scoring map

The 5 questions on the Risk Profile section each map to a 1–5 score:

| Answer key | Score |
|---|---|
| `superannuationCashOut` | |
| `wouldNeverCashOut` | 5 |
| `wouldStayCourse` | 4 |
| `wouldReduceRisk` | 3 |
| `wouldCashOutSome` | 2 |
| `wouldCashOutAll` | 1 |
| `investmentExperience` | |
| `extensiveExperience` | 5 |
| `someExperience` | 4 |
| `limitedExperience` | 3 |
| `littleExperience` | 2 |
| `noExperience` | 1 |
| `superannuationReaction` | |
| `seeAsOpportunity` | 5 |
| `holdAndWait` | 4 |
| `concernedButHold` | 3 |
| `consultAdviser` | 2 |
| `wouldSell` | 1 |
| `riskToleranceStyle` | |
| `seekHighestReturns` | 5 |
| `comfortableHigherRisk` | 4 |
| `balancedApproach` | 3 |
| `preferStability` | 2 |
| `avoidRiskEntirely` | 1 |
| `experienceLevel` | |
| `veryExperienced` | 5 |
| `experienced` | 4 |
| `moderatelyExperienced` | 3 |
| `limitedExperience` | 2 |
| `firstTime` | 1 |

Total score (5–25) maps to a profile band:

| Total score | Risk profile |
|---|---|
| 5–8 | Defensive |
| 9–12 | Conservative |
| 13–17 | Balanced |
| 18–21 | Growth |
| 22–25 | Aggressive |

The scoring map and bands are versioned in
`packages/insurance-engine/src/riskProfile/scoringMap-2025-08-01.ts`.
Override per tenant in admin (§10) without touching code.

---

### 19.8 Implementation Checklist — default content

Seeded into `clients.implementation_progress` when the workflow
transitions to `implementing`. Items can be added/removed/edited per
client. Conditional items (`when`) are seeded only if the predicate is
true at seed time.

```ts
[
  {
    key: 'engagement', label: 'Engagement',
    items: [
      { key: 'csa-signed',                label: 'Client Service Agreement signed',           owner: 'client',     when: 'always' },
      { key: 'engagement-letter-sent',    label: 'Engagement letter issued',                  owner: 'ar_support', when: 'always' },
      { key: 'fee-authority-signed',      label: 'Fee authority signed',                      owner: 'client',     when: 'always' },
      { key: 'id-verified',               label: 'ID verification complete',                  owner: 'ar_support', when: 'always' }
    ]
  },
  {
    key: 'insuranceApplications', label: 'Insurance Applications',
    items: [
      { key: 'apply-life',                label: 'Submit Life cover application',             owner: 'ar_support', when: 'recommendedInsurance.covers.includes(Life)' },
      { key: 'apply-tpd',                 label: 'Submit TPD cover application',              owner: 'ar_support', when: 'recommendedInsurance.covers.includes(TPD)' },
      { key: 'apply-trauma',              label: 'Submit Trauma cover application',           owner: 'ar_support', when: 'recommendedInsurance.covers.includes(Trauma)' },
      { key: 'apply-ip',                  label: 'Submit Income Protection application',      owner: 'ar_support', when: 'recommendedInsurance.covers.includes(IP)' }
    ]
  },
  {
    key: 'insuranceUnderwriting', label: 'Insurance Underwriting',
    items: [
      { key: 'medicals-booked',           label: 'Medical examinations booked',               owner: 'client',     when: 'recommendedInsurance.anyMedicallyUnderwritten' },
      { key: 'underwriting-questions',    label: 'Underwriting questions returned',           owner: 'client',     when: 'recommendedInsurance.anyMedicallyUnderwritten' },
      { key: 'policy-issued',             label: 'Policy issued',                             owner: 'ar_support', when: 'recommendedInsurance.any' }
    ]
  },
  {
    key: 'superRollovers', label: 'Super Rollovers',
    items: [
      { key: 'rollover-form-signed',      label: 'Rollover authority signed',                 owner: 'client',     when: 'superRecommendation.recommendation == Consolidate || Switch' },
      { key: 'rollovers-actioned',        label: 'Rollovers actioned at platform',            owner: 'ar_support', when: 'superRecommendation.recommendation == Consolidate || Switch' },
      { key: 'rollovers-confirmed',       label: 'Rollover receipts confirmed',               owner: 'ar_support', when: 'superRecommendation.recommendation == Consolidate || Switch' }
    ]
  },
  {
    key: 'superContributions', label: 'Super Contributions',
    items: [
      { key: 'salary-package-arranged',   label: 'Salary packaging arranged with employer',   owner: 'client',     when: 'contributionStrategy.salaryPackagedAmountAnnual > 0' },
      { key: 'noi-submitted',             label: 'Notice of Intent submitted',                owner: 'client',     when: 'contributionStrategy.personalConcessionalAmountAnnual > 0' },
      { key: 'spouse-contribution-paid',  label: 'Spouse contribution paid',                  owner: 'client',     when: 'contributionStrategy.spouseContribution > 0' },
      { key: 'co-contribution-eligible',  label: 'Co-contribution eligibility confirmed',     owner: 'ar_support', when: 'contributionStrategy.coContributionTarget > 0' }
    ]
  },
  {
    key: 'investmentSetup', label: 'Investment Setup',
    items: [
      { key: 'investment-account-opened', label: 'Investment account opened',                 owner: 'ar_support', when: 'investmentRecommendation.outsideSuperRecommendation == Open' },
      { key: 'initial-funding-received',  label: 'Initial funding received',                  owner: 'ar_support', when: 'investmentRecommendation.outsideSuperRecommendation == Open' },
      { key: 'ongoing-direct-debit-set',  label: 'Ongoing direct debit configured',           owner: 'ar_support', when: 'investmentRecommendation.ongoingContribution.amount > 0' }
    ]
  },
  {
    key: 'estateDocuments', label: 'Estate Documents',
    items: [
      { key: 'beneficiary-nominations',   label: 'Beneficiary nominations updated',           owner: 'ar_support', when: 'always' },
      { key: 'will-review-prompt',        label: 'Will review prompted with client',          owner: 'adviser',    when: '!personal.hasWill' }
    ]
  },
  {
    key: 'confirmationsSent', label: 'Confirmations Sent',
    items: [
      { key: 'implementation-summary',    label: 'Implementation summary sent to client',     owner: 'ar_support', when: 'always' },
      { key: 'next-ar-scheduled',         label: 'Next Annual Review scheduled in calendar',  owner: 'ar_support', when: 'always' },
      { key: 'set-next-ar-date',          label: 'Set client next_ar_date',                   owner: 'ar_support', when: 'always' }
    ]
  }
]
```

Each seeded item starts with `status: 'pending'`. Bulk-complete actions
in the UI close groups in one click. The `set-next-ar-date` item (last
group, last item) writes `clients.next_ar_date` and is required before
the workflow can transition out of `implementing` to `servicing`.

### 19.9 AR cadence rules

**`next_ar_date` is set by:**

1. The `set-next-ar-date` Implementation Checklist item (§19.8). Default
   value when the implementer opens the picker:
   `clients.soa_accepted_at + tenant.config.arDefaultOffsetMonths`
   (default 12).
2. Manually editable by `adviser`, `ar_adviser`, `tenant_super_admin`
   on the Client Overview, with audit-log entry on change.
3. Reset on AR completion: when `completeAR` transitions a client from
   `arPresented` → `servicing`, the system sets
   `next_ar_date = last_ar_completed_at + tenant.config.arDefaultOffsetMonths`.
   Per-client override survives if the user has touched the field
   manually since the last AR.

**Tenant config:**

```ts
team.config.arDefaultOffsetMonths       // 12 by default
team.config.arDueWindowDays             // 30; how early the auto-flag fires
team.config.arOverdueAlertDays          // 14; SLA breach alert
```

**Auto-flag job:**
- `auto-ar-due` (§5.5) runs every 30 minutes.
- Selects clients where `state = servicing`
  AND `next_ar_date - now() <= arDueWindowDays`.
- Transitions to `arDue`, emits a `workflow_events` row, and notifies
  `assigned_ar_adviser_id` (or `assigned_adviser_id` fallback) via
  in-app notification + the user's calendar provider as a tentative
  hold for the AR meeting.

**Overdue alert:**
- Separate cron `ar-overdue-alert` runs daily at 09:00 tenant-local.
- Selects clients where `state = arDue`
  AND `now() - next_ar_date > arOverdueAlertDays`.
- Posts an in-app notification to `management` users plus the
  assigned AR adviser.

### 19.10 Reverse Fact Find — section field map

The Reverse Fact Find (§6.16) is a confirmation pass executed during AR.
Each section pre-fills from current state and lets the AR adviser
confirm/update/replace. Section content:

| Section | Pre-fills from | Editable | Locked |
|---|---|---|---|
| Goals | `clients.goals` | All free-text answers, retirement age, retirement income | `_locked[goalKey]` per question respected |
| Employment | `clients.employment` | All fields | None |
| Income | `clients.financial` | All income items | None |
| Assets and Liabilities | `clients.assets` (unified asset+debt rows) | All rows | None |
| Superannuation | `clients.superannuation.currentFunds` | All 5 fields per fund (matches §7.5.5) | None |
| Beneficiaries | `clients.beneficiaries` | All rows | None |
| Contributions | `clients.contributions` | All rows + SG metadata | None |
| Risk Profile | `clients.risk_profile` | 5 radio answers; score & profile re-derive | `notes` is not locked |

Save semantics:
- Every change writes both to `clients.<section>` (the live Fact Find)
  AND to `clients.reverse_fact_find_data.runs[$current].changes` (a
  delta log).
- The AR Wizard's `reviewSnapshots` (§19.3.2) reads from the delta log.

The Reverse Fact Find does not unlock the SOA Wizard's fact-find lock —
that lock pertains to data state during SOA drafting; AR is a separate
post-SOA workstream.

### 19.11 File-note auto-generation — triggers and templates

The auto-generator runs on the BullMQ `cron` queue subscribed to the
`workflow_events` stream and writes file notes via
`createAutoFileNote`. Body templates are short, factual, and keyed to
the trigger.

| Trigger (workflow event or domain event) | File-note subject | Body template |
|---|---|---|
| `factFinding → factFindReady` | "Fact Find marked ready" | "{{actor}} marked the Fact Find as ready to hand off to advice on {{ts}}." |
| `factFindReady → handedOffToAdvice` | "Handed off to advice team" | "{{actor}} handed off to advice team {{advisoryTeam}}. Lead Gen team {{leadGenTeam}} no longer has access." |
| `handedOffToAdvice → factFindLocked` | "Fact Find locked" | "Fact Find locked by {{actor}}. Subsequent changes require a ROA / EO Wizard run." |
| `awaitingParaplanner` (entered) | "Sent to paraplanner queue" | "Client placed in paraplanner queue by {{actor}}." |
| `paraplannerClaimed` | "Paraplanner claimed client" | "{{actor}} claimed the SOA build for this client." |
| `paraplannerAutoReleased` | "Paraplanner claim auto-released" | "Auto-release fired after {{daysIdle}} days of inactivity." |
| `reviewingSOA → amendingSOA` | "SOA review feedback" | "{{actor}} requested changes: {{reason}}." |
| `reviewingSOA → soaPresented` | "SOA presented to client" | "SOA presented to {{clientName}} by {{actor}}." |
| `soaPresented → soaAccepted` | "SOA accepted" | "{{clientName}} accepted the SOA. Engagement letter to issue." |
| `soaPresented → notProceeding` | "Client not proceeding" | "{{actor}} marked client as not proceeding. Reason: {{reason}}." |
| `soaAccepted → implementing` | "Implementation started" | "{{actor}} started implementation. Default checklist seeded." |
| `implementing → implemented` | "Implementation complete" | "All implementation items closed by {{actor}}." |
| `auto-ar-due` | "Annual Review due" | "AR due date {{nextArDate}} reached. Assigned AR adviser: {{arAdviserName}}." |
| `arPresented → servicing` | "Annual Review completed" | "AR completed. Next AR scheduled for {{nextArDate}}." |
| `roaEoWizard` run finalised | "ROA/EO/AR letter issued" | "{{outputType}} issued by {{actor}}. Reason: {{trigger}}." |
| `envelope.completed` (DocuSign/Adobe) | "{{envelopeName}} signed" | "All signers completed {{envelopeName}} on {{ts}}." |
| `envelope.declined` | "{{envelopeName}} declined" | "{{declinedBy}} declined to sign on {{ts}}." |
| `markLost` | "Client marked lost" | "{{actor}} marked client as lost. Reason: {{reason}}." |
| `offboard` | "Client offboarded" | "{{actor}} offboarded client. Reason: {{reason}}." |

`createAutoFileNote` sets `is_auto = true` and `source_event = <eventName>`
on the row. Auto notes show a small "auto" tag in the UI.

---

### 19.12 Integration auth, scopes, webhooks, rate limits

#### 19.12.1 Firebase Auth (identity provider, retained)
- Web SDK on the frontend; Admin SDK on the API.
- Service account JSON stored as a single Doppler secret
  using the same `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` /
  `FIREBASE_PRIVATE_KEY` triplet form already in use in the legacy
  `.env` (so values copy across unchanged). The env loader normalises
  literal `\n` sequences in the private key to real newlines.
- ID token verification on every request; tokens have 1-hour TTL.
- MFA: enforced per tenant feature flag using Firebase MFA (TOTP
  or SMS — TOTP preferred).

#### 19.12.2 DocuSign
- **Auth**: JWT Grant (server integration), not OAuth 3-leg. Reasons:
  background workers send envelopes; no human in the loop. JWT scopes:
  `signature` + `impersonation`. Token expiry: 10 minutes; the
  integration helper refreshes per call.
- **Required env** (matches the names already in the legacy `.env` so
  they copy across unchanged):
  - `DOCUSIGN_INTEGRATION_KEY`
  - `DOCUSIGN_USER_ID` (the API user's GUID)
  - `DOCUSIGN_ACCOUNT_ID`
  - `DOCUSIGN_PRIVATE_KEY` (PEM body; the loader normalises literal
    `\n` sequences to real newlines, matching the legacy convention)
  - `DOCUSIGN_BASE_URI` (single base URI:
    `https://demo.docusign.net` for demo, `https://www.docusign.net`
    for production. The helper appends `/restapi` if not already
    present)
  - `DOCUSIGN_WEBHOOK_BASE_URL` (the public HTTPS URL DocuSign
    Connect calls back into this app — needed because Railway gives
    each environment a unique hostname; for local dev use an HTTPS
    tunnel such as ngrok)
  - `DOCUSIGN_WEBHOOK_SECRET` (HMAC key configured on the Connect
    listener; the webhook handler rejects unverified payloads)
- **Connect (webhook) events to subscribe**:
  - `envelope-sent`
  - `envelope-delivered`
  - `envelope-completed`
  - `envelope-declined`
  - `envelope-voided`
  - `recipient-completed`
  - `recipient-declined`
- **HMAC verification**: enabled in Connect; verified using
  `DOCUSIGN_WEBHOOK_SECRET`.
- **Rate limits**: 1000 req/hour per integration key. Burst handling
  via BullMQ concurrency cap.

The existing `server/docusignHelper.js` in the legacy codebase is the
working reference for the JWT flow; v3's `packages/esign/docusign/` may
port the same `requestJWTUserToken` flow against the published
`docusign-esign` SDK.

#### 19.12.3 Adobe Sign (alternate `EsignPort`)
- **Auth**: OAuth 2.0 with refresh token; refresh token stored
  encrypted in `users` for the per-user variant, or as a tenant-level
  service account where supported.
- **Required env**:
  - `ADOBESIGN_CLIENT_ID`
  - `ADOBESIGN_CLIENT_SECRET`
  - `ADOBESIGN_REDIRECT_URI`
- **Webhook events**: `AGREEMENT_CREATED`, `AGREEMENT_ACTION_COMPLETED`,
  `AGREEMENT_WORKFLOW_COMPLETED`, `AGREEMENT_ACTION_DECLINED`,
  `AGREEMENT_EXPIRED`. Verify with HMAC-SHA256 against the configured
  webhook secret.

#### 19.12.4 Microsoft Graph (calendar)
- **Auth**: OAuth 2.0 (delegated), authorisation code flow with PKCE.
  Refresh tokens stored encrypted per-user in `calendar_creds`.
- **Required env** (`MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`
  copy across from the legacy `.env`. `MICROSOFT_REDIRECT_URI` and
  `MICROSOFT_TENANT` are **new for v3** because per-PR previews on
  Vercel/Railway each get unique hostnames, so hard-coding the
  redirect URI is not viable):
  - `MICROSOFT_CLIENT_ID`
  - `MICROSOFT_CLIENT_SECRET`
  - `MICROSOFT_REDIRECT_URI` (NEW — must be registered in Azure AD
    for each environment)
  - `MICROSOFT_TENANT` (NEW — `common` for multi-tenant Microsoft 365)
- **Required scopes**:
  - `offline_access`
  - `User.Read`
  - `Calendars.ReadWrite`
  - `MailboxSettings.Read` (for time zone)
- **Subscriptions** (webhook): `me/events` change-tracking subscription
  with 3-day expiry; cron renews every 24 hours.
- **Rate limits**: ~10000 req/10min per app per tenant. Worker uses
  per-user concurrency = 1.

#### 19.12.5 Google Calendar (alternate calendar provider)
- **Auth**: OAuth 2.0 (web app flow); refresh tokens stored encrypted.
- **Required env**:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- **Required scopes**:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/userinfo.email`
- **Push notifications**: domain-verified webhook URL via the
  `events.watch` API; channel renewed daily.

#### 19.12.6 OmniLife
- **Auth**: HTTP **Basic Auth** (NOT bearer token). Every request must
  include an `Authorization: Basic <base64(username:password)>` header.
- **API version**: locked to **v4.58** (any upgrade triggers the
  regression checklist in `docs/OmniLife-API-Reference.md`).
- **Required env** (matches the names already in the legacy `.env` so
  they copy across unchanged):
  - `OMNILIFE_USERNAME`
  - `OMNILIFE_PASSWORD`
  - `OMNILIFE_BASE_URL` — per-environment, one of:
    - UAT: `https://apiuat.omnilife.com.au/api` (or
      `https://uat.omnilife.com.au/api/4`)
    - Production: `https://api.omnilife.com.au/api` (or
      `https://www.omnilife.com.au/api/4`)
    - The proxy strips trailing slashes and appends the API version
      path if the configured base does not already include `/api/4`.
  - `OMNILIFE_GROUP_ID` — value injected into every quote request's
    `tags.groupId`. Defaults to the literal string `'ExampleGroup'`
    when unset (matches the legacy proxy default).
- **Trial-supplier configuration (v1 launch)**: quotes are restricted
  to two insurers: **TAL** (supplier code `ACC`) and **Zurich**
  (supplier code `ZUR`). The frontend supplies insurer **names**;
  the proxy translates them to the **codes** required by OmniLife:

  ```ts
  const insurerNameToCode = { TAL: 'ACC', Zurich: 'ZUR' };
  const TRIAL_CODES = ['ACC', 'ZUR'];
  ```

  Any code outside the trial set is silently dropped, and an empty
  resolved set falls back to all trial codes. To add a new insurer
  later, expand both maps and add a regression test that quotes
  succeed against the new supplier.
- **Throttling**: documented soft limit of 60 req/min per credential.
  Worker uses BullMQ concurrency = 4 with rate-limit token bucket
  60-per-60-seconds.
- **Caching**: quote responses cached in Redis for 60 minutes keyed by
  the canonicalised request body, to avoid duplicate billable calls
  during a single quoting session.

> **Canonical reference**: the existing
> [`docs/OmniLife-API-Reference.md`](./OmniLife-API-Reference.md) (1,598
> lines, locked to API v4.58) is **adopted unchanged** as the v3 source
> of truth for OmniLife. It documents every endpoint, the trial-supplier
> matrix, behavioural rules (TPD silent drop, IP availability edge
> cases, `premiumTotal` shape, `productExclusions` format, `resolvedNeeds`
> shape), and the regression checklist. v3's
> `packages/insurance-quoting/omnilife/` must conform to that
> specification; any deviation needs a change to that document first.

#### 19.12.7 Lonsec — Phase B (post-launch)
- **Status at v1 launch**: **not integrated**. The vendor relationship
  and authentication scheme are still in negotiation — see
  [`docs/Lonsec-API-Integration.md`](./Lonsec-API-Integration.md) for
  the answer document we sent Lonsec covering platform, data needs,
  and integration approach.
- **v1 substitute**: the Recommended Portfolios admin (§10.6) is
  populated entirely by hand at launch. Tenant super-admins enter
  asset allocation, fees, historical performance, and Lonsec rating
  manually per portfolio. This is acceptable because the launching
  tenant has a small recommended portfolio set.
- **When Lonsec goes live (Phase B)**:
  - **Auth**: TBD (vendor will confirm — API key, OAuth 2.0, or
    token-based — our proposal supports all three).
  - **Required env (anticipated)**:
    - `LONSEC_API_KEY` (or OAuth equivalents)
    - `LONSEC_API_BASE`
  - **Pattern**: nightly batch + local cache (per the answer document):
    a scheduled job pulls the catalogue and upserts into a read-only
    `lonsec_portfolios` mirror table. The Recommended Portfolios admin
    overlays Lonsec rating/performance data on top of the manual
    entries; admins reconcile differences.
  - **Critical**: end users never invoke Lonsec API endpoints directly,
    in line with the Lonsec API Usage Guidelines.

#### 19.12.8 SendGrid
- **Auth**: API key.
- **Required env** (`SENDGRID_API_KEY` copies across from the legacy
  `.env`. The two from-address vars are **new for v3** — the legacy
  app hard-coded the sender, which would not work multi-tenant):
  - `SENDGRID_API_KEY`
  - `SENDGRID_FROM_EMAIL` (NEW — verified sender; per-environment)
  - `SENDGRID_FROM_NAME` (NEW)
- **Templates**: dynamic templates managed in SendGrid; the API
  references templates by ID. Required templates and their IDs are
  listed in `packages/email/src/templates/index.ts`:
  - `welcome` — new user invite
  - `mfa-prompt` — when MFA enrolment is required
  - `paraplanner-claim-request` — to paraplanner pool
  - `soa-review-request` — adviser is asked to review
  - `ar-due` — to AR adviser
  - `envelope-completed` — to client and assigned adviser
  - `envelope-declined` — to assigned adviser
  - `password-reset` — fallback (Firebase handles primary)
- **Bounce/spam handling**: SendGrid Event Webhook enabled with HMAC
  verification; events written to `email_events` table.

#### 19.12.9 Anthropic Claude
- **Auth**: API key.
- **Env-var rename at cutover**: the legacy `.env` uses `CLAUDE_API_KEY`.
  The official `@anthropic-ai/sdk` reads `ANTHROPIC_API_KEY` by
  default, so v3 standardises on `ANTHROPIC_API_KEY` (and ops renames
  the secret in Doppler/Railway). To make the cutover painless, the
  v3 env loader at `apps/api/src/config/env.ts` accepts either name
  during a 30-day transition window and emits a deprecation warning
  when only the legacy name is set.
- **Required env**:
  - `ANTHROPIC_API_KEY` (preferred; transitional alias `CLAUDE_API_KEY`)
  - `ANTHROPIC_DEFAULT_MODEL` (default `claude-3-7-sonnet-20250219`)
- **Default model selection per prompt key** lives in
  `packages/ai/src/registry.ts`. Model overrides in the AI Prompt
  admin (§10.4).
- **Budget**: per-tenant monthly token cap (`tenant.aiBudgetUsdPerMonth`,
  default 200 USD). Over-budget calls fail closed.
- **Redaction** before send (per prompt config):
  - PII fields listed in §19.16 are masked or omitted.
  - Default mask: `***-mask:<fieldName>***`.

#### 19.12.10 Sentry, PostHog, Honeycomb
- **Sentry**: `SENTRY_DSN` per app; release tagged with git SHA;
  source maps uploaded on deploy.
- **PostHog**: `POSTHOG_KEY`, `POSTHOG_HOST`. Session replay enabled
  with PII masking from `data_classification.md`.
- **Honeycomb**: `HONEYCOMB_API_KEY`, `OTEL_SERVICE_NAME` per service.

### 19.13 DocuSign tab placement convention

Anchored placement only. **Absolute positioning is disallowed** — it
breaks when DOCX → PDF conversion (which DocuSign does internally)
shifts content by even one line.

The legacy app already uses a working anchor convention with
double-curly placeholder strings (see `server/docusignHelper.js`
in the legacy codebase). v3 **adopts the same convention unchanged**
so that existing DOCX templates and the muscle-memory of paraplanners
authoring new templates carry across without re-tooling.

#### 19.13.1 Canonical anchor strings

| Anchor | Tab type | Required | Notes |
|---|---|---|---|
| `{{clientSignature}}` | Signature | required | Primary client signature (routing order 1) |
| `{{clientDate}}` | Date Signed | required | Paired with `{{clientSignature}}`; auto-fills with signing date |
| `{{partnerSignature}}` | Signature | conditional | Used only when `personal.maritalStatus in ['Married', 'De facto']` AND `soaWizard.cover.preparedForPartner = true` (routing order 1) |
| `{{partnerDate}}` | Date Signed | conditional | Paired with `{{partnerSignature}}` |
| `{{adviserSignature}}` | Signature | required | Adviser signature (routing order 2) |
| `{{adviserDate}}` | Date Signed | required | Paired with `{{adviserSignature}}` |
| `{{clientInitial1}}`, `{{clientInitial2}}`, … | Initial Here | optional | Per-page initial blocks; numeric suffix increments |
| `{{adviserInitial1}}`, … | Initial Here | optional | As above for adviser |
| `{{textNote1}}` | Free Text | optional | Adviser-fillable free-text field |
| `{{consent1}}`, `{{consent2}}`, … | Checkbox | conditional | Used in `authority-to-proceed` consents loop |

#### 19.13.2 Routing

Recipients are assigned in this fixed order by
`packages/esign/docusign/src/buildEnvelope.ts`:

1. **Client** — routing order 1, primary signer.
2. **Partner** — routing order 1, conditional. Added only when the two
   conditions above are both met. Sits beside the client so they sign in
   parallel.
3. **Adviser** — routing order 2. Signs after the client(s) complete.

#### 19.13.3 Anchor visibility

Anchor strings are **white-on-white, 1pt text** inside the DOCX template
so they are invisible in the rendered document but discoverable by
DocuSign's anchor matcher. The DOCX template authoring guide
(`packages/document-templates/AUTHORING.md`) shows how to apply the
hidden style and includes a Word `.dotx` style preset.

#### 19.13.4 Adobe Sign parity (Phase B)

If/when Adobe Sign is enabled as a second `EsignPort`, the same
double-curly anchor strings are mapped to Adobe Sign's `text-tag`
syntax (`{{*ES_:signer1:signature}}` etc.) by the Adobe adapter at
envelope build time. Templates remain unchanged; only the envelope
builder differs per provider.

### 19.14 Strategy page — content specification

Six tabs. Each tab has a fixed set of **summary tiles** (read-only,
derived) and a **strategy notes** block (free text, AI-assist-eligible,
flows into the SOA's `strategyRecommendations.themes`).

#### 19.14.1 Cashflow tab
- Tile: `Total income (annual)` ← `financial.totalIncomeAnnual`
- Tile: `Total SG (annual)` ← `financial.totalSgAnnual`
- Tile: `Total liabilities` ← `assets.totalLiabilities`
- Tile: `Estimated weekly expenses` ← editable adviser entry
- Tile: `Surplus before strategy (annual, derived)` ← computed as
  `totalIncomeAnnual - 52*estimatedWeeklyExpenses - totalLoanRepaymentsAnnual`
- Notes block

#### 19.14.2 Insurance tab
- Tile: `Total Life sum insured` ← derived from
  `insurance.covers where coverType=='Life'`
- Tile: `Total TPD sum insured` ← derived
- Tile: `Trauma sum insured` ← derived
- Tile: `IP monthly benefit` ← derived
- Tile: `Total annual premium` ← derived
- Tile: `Calculated Life need` ← engine output (§19.6)
- Tile: `Calculated TPD need` ← engine output
- Tile: `Calculated Trauma need` ← engine output
- Tile: `Calculated IP monthly benefit need` ← engine output
- Notes block (auto-prefilled with delta narrative on first open)

#### 19.14.3 Super tab
- Tile: `Number of funds` ← `superannuation.currentFunds.length`
- Tile: `Total balance` ← derived
- Tile: `Estimated total fees % (weighted)` ← derived using portfolio
  config when matched by name
- Tile: `Risk profile` ← `risk_profile.riskProfile`
- Tile: `Annual employer SG` ← `financial.totalSgAnnual`
- Tile: `Annual concessional contributions` ← derived
- Tile: `Annual non-concessional contributions` ← derived
- Notes block

#### 19.14.4 Investment tab
- Tile: `Investment assets (excl. PPOR)` ← derived
- Tile: `Recommended platform (placeholder)` ← null until set in
  SOA Wizard
- Tile: `Risk profile` ← mirror of Super tab
- Notes block

#### 19.14.5 Estate tab
- Tile: `Has will` ← `personal.hasWill`
- Tile: `Has dependants` ← `personal.hasDependants`
- Tile: `Beneficiary nominations on record` ← count from
  `beneficiaries.items`
- Tile: `Sum of nominations per fund` ← derived (red if any fund
  doesn't sum to 100%)
- Notes block

#### 19.14.6 Retirement tab
- Tile: `Desired retirement age` ← `goals.desiredRetirementAge`
- Tile: `Desired retirement income (weekly)` ← `goals.desiredRetirementIncomeWeekly`
- Tile: `Years to retirement` ← derived from primary's age
- Tile: `Combined super at retirement (baseline)` ← from the latest
  `projection_runs` keyed to this client, scenario `baseline`
- Tile: `Combined super at retirement (recommended)` ← scenario
  `recommended` (null until SOA Wizard projections are run)
- Tile: `First shortfall year (baseline)` ← from projection summary
- Notes block

The Strategy page is **read-only** for tiles. Notes are persisted to
`clients.strategy_notes` (a sibling JSONB on `clients`, keyed per tab).
On finalising the SOA Wizard, the user is offered to copy strategy
notes into the appropriate `soaWizard.strategyRecommendations.themes`.

### 19.15 Brand-colour derivation function

Configured tenants supply only `color.brand.primary` and
`color.brand.accent` (two hex/OKLCH values). All variants — hover,
pressed, contrast — are derived deterministically.

The derivation lives in `packages/branding/src/deriveColours.ts`:

```ts
import { converter, formatHex, oklch } from 'culori';

const toOklch = converter('oklch');
const fromOklch = converter('rgb');

export function deriveBrandPalette(brandHex: string) {
  const base = toOklch(brandHex);

  const shift = (lDelta: number, cDelta = 0) => formatHex(fromOklch({
    mode: 'oklch',
    l: clamp01(base.l + lDelta),
    c: Math.max(0, base.c + cDelta),
    h: base.h ?? 0,
  }));

  const contrastFor = (bg: string) => luminance(bg) > 0.55 ? '#0F172A' : '#FFFFFF';

  return {
    base:           formatHex(base),
    hover:          shift(-0.04),                  // slightly darker
    pressed:        shift(-0.08),                  // darker still
    subtle:         shift(+0.32, -0.08),           // pale tint for backgrounds
    rowSelection:   shift(+0.36, -0.10),           // table-row selection bg
    onBrand:        contrastFor(formatHex(base)),  // text on brand
  };
}
```

Specifically:
- `primaryHover`     = `lighten/darken L by -0.04 in OKLCH`
- `primaryPressed`   = `L by -0.08`
- `primaryContrast`  = white if perceived luminance < 0.55, else
  `text.primary`
- `selection.rowBackground` = `L by +0.36, C by -0.10` over
  `surface.raised` (yields the pale-blue selection state in the
  reference image)

The accent palette uses the same function with the accent input.
Contrast pairs (e.g. `text.onBrand` on `brand.base`, `text.primary` on
`selection.rowBackground`) are CI-verified to ≥ WCAG 2.2 AA (4.5:1 for
body text, 3:1 for large text and UI components).

### 19.16 PII handling and encryption

**Classification** (companion file `docs/data_classification.md`,
inlined here for reference):

| Field | Class | Storage | Notes |
|---|---|---|---|
| `personal.taxFileNumber` | PII (sensitive) | `pgcrypto` AEAD | Masked in UI as `***-***-NNN`. Decrypted only on documents render and admin export. |
| `personal.partnerTaxFileNumber` (if added) | PII (sensitive) | `pgcrypto` AEAD | Same |
| `personal.dateOfBirth`, `partnerDateOfBirth`, `dependants.dateOfBirth` | PII | RLS only | |
| `personal.email`, `personal.mobile`, `nextOfKinContact` | PII | RLS only | |
| `personal.homeAddress.*`, `postalAddress.*` | PII | RLS only | |
| `personal.healthNotes`, `insuranceClaim.notes`, insurance underwriting notes | PII (sensitive) | RLS + AI-redaction | Always redacted before any Claude call |
| `audit_log.payload`, `admin_audit_log.payload` | INTERNAL | RLS only | |
| Bank account numbers, BSBs | not stored | — | Captured only at signing time via DocuSign tab; never persisted server-side |

**Encryption details:**
- Algorithm: `pgp_sym_encrypt` from `pgcrypto` (AEAD via PGP-symmetric).
- Key per tenant, stored in Doppler as `TENANT_ENC_KEY__<tenant_slug>`.
- Loaded into Postgres via a session-scoped GUC `app.tenant_enc_key`
  set by the same middleware that sets `app.current_tenant_id`.
- Encrypted columns are stored as `bytea`. Reads use a Postgres view
  that exposes a decrypted text alias only when the GUC is set.
- Rotation: yearly, dual-write window of 30 days. The `tenants` table
  carries `enc_key_version`; the row is rewritten by a worker that
  re-encrypts under the new version, then the old key is retired.

**AI redaction:** the `redaction.fields` list on each registered prompt
(§10.4) is enforced by a single function in `packages/ai/src/redact.ts`
that walks the input object and replaces matching paths.

### 19.17 Localisation defaults

Australia-only at v1 launch. Defaults:

- **Locale**: `en-AU`.
- **Currency**: `AUD`, formatted via `Intl.NumberFormat('en-AU', {
  style: 'currency', currency: 'AUD' })`. Negative amounts in
  parentheses inside tables; minus sign in body text.
- **Dates**: input `dd/MM/yyyy`, display `d MMM yyyy` (e.g. `5 Aug 2025`)
  in body text and `dd MMM yyyy` in tables. ISO `YYYY-MM-DD` in
  the API and DB.
- **Time**: 24-hour `HH:mm` in workflows and timestamps; 12-hour with
  AM/PM in user-facing audit log lines (calendar events use 12-hour).
- **Time zone**: tenant-level setting (`tenant.timezone`, default
  `Australia/Sydney`). UI renders all timestamps in the tenant's
  zone unless the user overrides in their profile.
- **First day of week**: Monday.
- **Phone numbers**: stored as `+61...` E.164; UI displays Australian
  national format `04XX XXX XXX`.

### 19.18 Internationalisation strategy

**No i18n framework at v1 launch.** All user-facing strings live as
plain `const` exports under `apps/web/src/strings/<feature>.ts`. The
benefit of this approach for a single-locale launch is zero runtime
cost and trivial PR review.

A lint rule scans JSX text nodes and `aria-label`/`title`/`alt`
attributes for string literals; every literal must come from a
`strings/*.ts` module or be wrapped in a `Tx(...)` no-op marker. The
`Tx` marker is in place specifically so that, when a future locale is
added, replacing `Tx` with `t` (a real translator) is a mechanical
rename across the codebase rather than a refactor.

Backend-side, all human-readable strings (toast messages, audit-log
entries, file-note auto templates) live in
`packages/strings/<domain>.ts` keyed by an enum, and are looked up
through a `strings(key, params)` function. The function is locale-aware
already (signature accepts a `locale` argument) but always returns the
`en-AU` value at v1.

### 19.19 Environment variable inventory

All env vars are loaded through a per-app Zod-validated env loader
(§11.5). The complete inventory:

Three classes of env var are flagged in the comments below:
- `[copies]` — same name as the legacy `.env`; copy across unchanged.
- `[NEW]` — new for v3; must be created in Doppler/Railway.
- `[v3-only]` — does not exist in the legacy app at all (Postgres,
  Redis, S3, observability stack).

#### 19.19.1 `apps/api`
```
NODE_ENV                                  # [v3-only]
PORT                                      # [v3-only] default 3001
APP_BASE_URL                              # [v3-only] e.g. https://app.advicelink.com
WEB_BASE_URL                              # [v3-only] for CORS allow-list
DATABASE_URL                              # [v3-only] Railway Postgres
REDIS_URL                                 # [v3-only] Railway Redis
S3_BUCKET                                 # [v3-only]
S3_REGION                                 # [v3-only] ap-southeast-2
S3_ACCESS_KEY_ID                          # [v3-only]
S3_SECRET_ACCESS_KEY                      # [v3-only]
S3_KMS_KEY_ID                             # [v3-only]

FIREBASE_PROJECT_ID                       # [copies]
FIREBASE_CLIENT_EMAIL                     # [copies]
FIREBASE_PRIVATE_KEY                      # [copies] PEM with literal \n; loader normalises

ANTHROPIC_API_KEY                         # [NEW] preferred name; transitional alias CLAUDE_API_KEY accepted for 30 days
ANTHROPIC_DEFAULT_MODEL                   # [NEW] default 'claude-3-7-sonnet-20250219'

DOCUSIGN_INTEGRATION_KEY                  # [copies]
DOCUSIGN_USER_ID                          # [copies]
DOCUSIGN_ACCOUNT_ID                       # [copies]
DOCUSIGN_PRIVATE_KEY                      # [copies] PEM body; loader normalises literal \n
DOCUSIGN_BASE_URI                         # [copies] e.g. https://demo.docusign.net (demo) or https://www.docusign.net (prod)
DOCUSIGN_WEBHOOK_BASE_URL                 # [NEW] public HTTPS URL Connect calls back into; per-environment
DOCUSIGN_WEBHOOK_SECRET                   # [NEW] HMAC key for Connect signature verification

ADOBESIGN_CLIENT_ID                       # [v3-only, optional, Phase B]
ADOBESIGN_CLIENT_SECRET                   # [v3-only, optional, Phase B]
ADOBESIGN_REDIRECT_URI                    # [v3-only, optional, Phase B]

MICROSOFT_CLIENT_ID                       # [copies]
MICROSOFT_CLIENT_SECRET                   # [copies]
MICROSOFT_REDIRECT_URI                    # [NEW] per-environment, must be registered in Azure AD
MICROSOFT_TENANT                          # [NEW] 'common' for multi-tenant Microsoft 365

GOOGLE_CLIENT_ID                          # [v3-only, optional, Phase B]
GOOGLE_CLIENT_SECRET                      # [v3-only, optional, Phase B]
GOOGLE_REDIRECT_URI                       # [v3-only, optional, Phase B]

OMNILIFE_USERNAME                         # [copies] Basic Auth username
OMNILIFE_PASSWORD                         # [copies] Basic Auth password
OMNILIFE_BASE_URL                         # [copies] e.g. https://apiuat.omnilife.com.au/api or https://api.omnilife.com.au/api
OMNILIFE_GROUP_ID                         # [copies] tags.groupId injected on every quote; default 'ExampleGroup'

# Lonsec is Phase B — no env vars at v1 launch
# LONSEC_API_KEY                          # [v3-only, deferred]
# LONSEC_API_BASE                         # [v3-only, deferred]

SENDGRID_API_KEY                          # [copies]
SENDGRID_FROM_EMAIL                       # [NEW] verified sender; per-environment
SENDGRID_FROM_NAME                        # [NEW]

SENTRY_DSN                                # [v3-only]
POSTHOG_KEY                               # [v3-only]
POSTHOG_HOST                              # [v3-only]
HONEYCOMB_API_KEY                         # [v3-only]
OTEL_SERVICE_NAME                         # [v3-only] 'api'

LOG_LEVEL                                 # [v3-only] default 'info'
RATE_LIMIT_PER_MIN_DEFAULT                # [v3-only] default 600
```

#### 19.19.2 `apps/workers`
Same as API plus:
```
WORKER_QUEUES                             # comma list, default 'documents,ai,esign,cron,virusScan'
WORKER_CONCURRENCY_DOCUMENTS              # default 4
WORKER_CONCURRENCY_AI                     # default 2
CLAMAV_HOST                               # default 'clamav'
CLAMAV_PORT                               # default 3310
OTEL_SERVICE_NAME                         # 'workers'
```

#### 19.19.3 `apps/web` (build-time)
```
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_SENTRY_DSN
VITE_POSTHOG_KEY
VITE_POSTHOG_HOST
VITE_DEFAULT_TIMEZONE                     # 'Australia/Sydney'
VITE_GIT_SHA                              # injected at build time
```

The Zod loader validates types and `format` (e.g. URL fields parsed by
`z.string().url()`) and fails fast on boot.

### 19.20 Performance and cost budgets

#### 19.20.1 Sizing assumptions (v1 launch)

| Dimension | Assumption |
|---|---|
| Tenants at launch | 1 |
| Active users in tenant | ~50 |
| DAU at peak | ~25 |
| New leads/day | 10 |
| Active clients in `drafting` simultaneously | 50 |
| Active clients in `servicing` | 200 |
| SOA renders/week | 15 |
| ROA / EO / AR letters/week | 20 |
| Quick Quotes/week | 10 |
| Document storage size after 1 year | <50 GB |

#### 19.20.2 Performance targets

| Surface | Metric | Target |
|---|---|---|
| Portal listing pages (any role) | TTFB | <200ms p95 |
| Portal listing pages | LCP | <1.5s p95 |
| Client overview | LCP | <1.5s p95 |
| Fact Find autosave | Round-trip | <250ms p95 |
| SOA Wizard autosave | Round-trip | <250ms p95 |
| AI assist invocation | Round-trip | <8s p95 |
| DOCX render | Queue → completion | <8s p95 |
| Quick Quote (OmniLife) | Round-trip | <4s p95 |
| OmniLife rate-limit headroom | Tokens/min | ≥40 free of 60 |

#### 19.20.3 Cost budgets (per tenant, per month)

| Line | Default cap | Action on breach |
|---|---|---|
| Anthropic tokens | $200 USD | Disable AI assist; in-app banner |
| OmniLife calls | $500 USD | Throttle to read-only cache |
| SendGrid emails | $30 USD | Pause non-critical templates |
| S3 storage | $50 USD | Notify tenant admin |
| Total Railway compute | $400 USD | Notify platform admin |

CI publishes a synthetic-cost dashboard in PostHog so finance can
see actual vs. budget per tenant.

### 19.21 Error-handling and messaging conventions

#### 19.21.1 Error envelope (server)

Every tRPC error returns:

```ts
{
  code,                          // tRPC code: BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, TOO_MANY_REQUESTS, INTERNAL_SERVER_ERROR
  message,                       // user-safe sentence (no stack, no PII, no internal IDs)
  domainCode,                    // narrower app code: 'fact-find/locked', 'workflow/illegal-transition', 'document/template-not-found', etc.
  fieldErrors,                   // optional: { 'personal.firstName': 'Required', ... }
  traceId,                       // matches Sentry/Honeycomb; safe to display to user for support
  retryable                      // bool; for client retry policy hinting
}
```

#### 19.21.2 Client-side surfacing

| Error class | UI treatment |
|---|---|
| `BAD_REQUEST` with `fieldErrors` | Inline under each field; banner above form summarising "Please fix the highlighted fields" |
| `BAD_REQUEST` without fields | Toast (warning) |
| `UNAUTHORIZED` | Redirect to login |
| `FORBIDDEN` | Full-page `<ErrorState kind="forbidden" />`; never a toast (denied access deserves a clear page) |
| `NOT_FOUND` | Full-page `<ErrorState kind="not-found" />` |
| `CONFLICT` (e.g. workflow transition) | Inline banner with the legal next-action |
| `TOO_MANY_REQUESTS` | Toast with retry-in countdown (driven by `Retry-After`) |
| `INTERNAL_SERVER_ERROR` | Toast with `traceId` and a "Contact support" link; auto-reported to Sentry |
| Network offline | Persistent banner at top: "You are offline. Edits will sync when you reconnect." Background sync queue resumes pending writes. |

#### 19.21.3 Idempotency

Every mutation that has a non-trivial side effect outside the database
(documents render, e-sign envelope create, calendar event create, AI
call) accepts an `Idempotency-Key` header. The server stores the key in
a `idempotency_keys` table (24h TTL) and replays the original response
on duplicate requests. The frontend generates UUIDs per logical action
and includes them automatically via the tRPC link.

#### 19.21.4 Retries

- Read queries: TanStack Query default — 3 retries with exponential
  backoff, but **only for** `429`/`5xx`.
- Writes: never auto-retried by the client. The user is shown the error
  and chooses to retry. The exception is the offline-sync queue, which
  retries with backoff up to 6 attempts then escalates to a toast.

### 19.22 Empty / loading / error state catalogue

Three semantic components handle these states. Each has a short copy
register and a token-driven illustration. Copy is intentionally calm
and action-oriented.

#### 19.22.1 `<EmptyState>`

| Surface | Title | Subtitle | Primary action |
|---|---|---|---|
| GA Portal — no leads | "No leads yet" | "When you capture a new lead it will appear here." | "Add lead" |
| Adviser Portal — no assigned clients | "No clients assigned to you yet" | "Once a Lead Gen team hands off a client you'll see them here." | none |
| Paraplanner Portal — Available queue empty | "All caught up" | "There are no clients waiting for paraplanner action." | none |
| Paraplanner Portal — Claimed empty | "You haven't claimed any clients" | "Pick a client from Available to start working." | "Go to Available" |
| Document Storage empty | "No documents yet" | "Generated documents and uploads will appear here." | "Upload" |
| File Notes empty | "No file notes yet" | "Add a note to capture context, calls, or decisions." | "Add note" |
| Audit Log empty | "No activity yet" | "Significant changes are recorded here automatically." | none |
| Envelopes empty | "No envelopes yet" | "Once you send a document for signature it will appear here." | "Send envelope" |
| Calendar empty | "No upcoming meetings" | "Schedule a meeting to see it here." | "Schedule meeting" |
| Quick Quote — no result | "No matching products" | "Try widening your inputs and run the quote again." | "Edit inputs" |
| Projections — no run yet | "Run a projection to see results" | "Configure inputs on the left then click Run." | "Run projection" |
| Implementation Checklist — all done | "Implementation complete" | "All checklist items are closed. Ready to move to Servicing." | "Move to Servicing" |
| Reverse Fact Find — no AR run active | "Start an Annual Review to begin" | "The Reverse Fact Find is part of an AR run." | "Start AR" |

#### 19.22.2 `<LoadingState>`
- Single-component variant: skeleton blocks shaped like the eventual
  content (rows in tables, cards in kanban, fields in forms).
- Page-load variant: subtle `<ProgressBar indeterminate />` at top of
  `<PageShell>` plus skeletons in body.
- Worker-driven variant (DOCX render, AI assist, OmniLife quote):
  inline progress chip ("Rendering…", "Thinking…", "Quoting…") with a
  cancel button when cancellable; otherwise just the chip.

#### 19.22.3 `<ErrorState>`

| Kind | Title | Subtitle | Primary action |
|---|---|---|---|
| `not-found` | "We couldn't find that" | "The page or record may have been removed, or your access changed." | "Back to portal" |
| `forbidden` | "You don't have access to this" | "Speak to your administrator if you believe you should." | "Back" |
| `network` | "Connection problem" | "Check your network and try again. Pending edits will sync." | "Retry" |
| `internal` | "Something went wrong" | "We've recorded the error. Reference: {traceId}." | "Retry" / "Contact support" |
| `template-missing` | "We can't render this document yet" | "The template hasn't been published. An admin can configure it under Document Templates." | "Open Document Templates" (admins only) |
| `integration-down` | "{Provider} is unavailable" | "We'll keep retrying. You can continue with other work." | "Refresh" |
| `quota-exceeded` | "AI assist paused for this month" | "Your tenant's AI budget for the month is reached." | "Contact admin" |

Illustrations are tiny SVG marks (one per kind) coloured via tokens.
No stock photography.

---

*End of plan.*

