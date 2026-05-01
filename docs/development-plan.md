# HidroSync Development Plan

This document captures **how** we are going to build HidroSync, complementary to:

- [`hidrosync_workflow.md`](../hidrosync_workflow.md) — the product spec (what the system does).
- [`Infrastructure-plan.md`](../Infrastructure-plan.md) — the GCP/Terraform infra plan.
- [`docs/architecture-decisions.md`](./architecture-decisions.md) — the discrete tech choices.
- [`docs/meter-reading-pipeline.md`](./meter-reading-pipeline.md) — the QR + AI vision pipeline (the trickiest single feature).

The plan has two axes: a **folder scaffold** (so the codebase stays navigable as it grows) and a **delivery sequence** of milestones (so each PR is reviewable and ships a real URL).

---

## 1. Folder Scaffold (`hidrosync-service/`)

The README commits to Next.js 14 App Router + shadcn + raw `pg`. The workflow has clear bounded contexts (onboarding, periods, readings, consumption, billing, audit) — make those first-class folders so they don't bleed into each other.

```plaintext
hidrosync-service/
├── app/                              # App Router (UI + thin route handlers)
│   ├── (marketing)/                  # public landing, login (route group, no auth)
│   ├── (app)/                        # auth-required shell
│   │   ├── onboarding/               # §1 prompt → preview → commit
│   │   ├── meters/                   # listing, QR print
│   │   ├── reading/                  # §4 capture + §5 review (filters)
│   │   ├── consumption/              # §6 admin views
│   │   ├── billing/                  # §7 export
│   │   ├── admin/                    # condo config, users, audit log
│   │   └── tenant/                   # §6 viewer-scoped portal
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── onboarding/
│       ├── readings/
│       ├── periods/                  # state transitions
│       ├── billing/
│       ├── scheduler/                # cron-target endpoints
│       └── webhooks/
├── modules/                          # server-side domain logic (NOT React)
│   ├── auth/                         # NextAuth config, session helpers
│   ├── rbac/                         # grants, requireRole(), policy fns
│   ├── condos/                       # condos + condo_config
│   ├── groups/
│   ├── units/
│   ├── meters/                       # meters + linked_meters polymorphism
│   ├── readings/                     # capture, EXIF, AI adapter wiring
│   ├── periods/                      # state machine + scheduler driver
│   ├── consumption/                  # per-meter and common-area math
│   ├── billing/                      # CSV generation + versioning
│   ├── audit/                        # write-only log helper
│   ├── ai/                           # OpenRouter adapter (meter value extraction)
│   └── notifications/
├── components/
│   ├── ui/                           # shadcn primitives
│   ├── forms/
│   ├── qr/                           # QR render, print grid, scanner
│   ├── reading/                      # capture widget, anomaly badges
│   └── layout/
├── lib/
│   ├── db/                           # Drizzle client, schema, query helpers
│   ├── gcs/                          # signed URLs, uploads
│   ├── exif/                         # EXIF parser
│   ├── csv/                          # billing export writer
│   └── validation/                   # zod schemas shared client/server
├── drizzle/                          # generated migrations + drizzle config
├── scripts/
│   ├── setup-database.ts
│   ├── create-admin.ts
│   └── seed-dev.ts
├── types/                            # cross-cutting TS types only
├── tests/
│   ├── e2e/                          # Playwright (per milestone)
│   └── unit/
├── docs/                             # app-specific docs (visual guide, etc.)
└── public/
```

### Why `modules/` and not just `lib/`

Each section of the workflow (`§4 Meter Reading`, `§5 Review`, `§6 Consumption`, `§7 Billing`, `Meter Lifecycle`, `Audit Log`) maps to a `modules/<context>` folder you can grep for. `lib/` stays reserved for genuinely generic utilities (db client, GCS, EXIF parsing, CSV writer) that have no domain knowledge.

### Route group conventions

- `(marketing)` — unauthenticated public surface (landing, login, password reset).
- `(app)` — authenticated shell with the global nav, role-aware sidebar, condo switcher.
- `app/api/` — route handlers. Keep them thin: parse + authorize + delegate to `modules/`.

---

## 2. Cross-Cutting Scaffolding (Land in M0)

These foundations every later milestone depends on, so build them once with care:

| Concern | What to scaffold |
|---|---|
| **DB schema + migrations** | Drizzle ORM with the full schema from `hidrosync_workflow.md §Data Model`. `drizzle-kit generate` produces migrations; `drizzle-kit migrate` applies them. See [`architecture-decisions.md`](./architecture-decisions.md#41-orm--migrations-drizzle). |
| **RBAC primitives** | `modules/rbac/` exports `getEffectiveGrants(userId, condoId)` and `requireRole(scope, role)`. Every server action and route handler funnels through it. The "union of grants" rule from the spec lives here, nowhere else. |
| **Period-aware queries** | Helpers like `getOpenPeriod(condoId)` and `assertPeriodState(periodId, ['reading_open'])` so route handlers don't reimplement state-machine guards. |
| **Audit log writer** | `modules/audit/log.ts` with one function `writeAudit({ actor, entity, action, before, after, reason })`. **Every mutation** calls it — make it required by passing it as the first argument of the transaction helper. |
| **GCS + EXIF pipeline** | One ingest function `ingestPhoto(file)` that uploads, returns the GCS path + parsed EXIF + EXIF capture timestamp. Used by reading capture **and** logo upload. |
| **AI adapter (OpenRouter)** | `modules/ai/MeterReader.ts` interface with a `MockMeterReader` for dev and `OpenRouterMeterReader` for real use. See [`meter-reading-pipeline.md`](./meter-reading-pipeline.md). |
| **Polymorphic scope view** | A SQL view `meter_scope_resolved` that flattens `(meter, target_kind, target_id)` rows from `linked_meters` into the actual unit set each meter covers. Used everywhere consumption is computed. See [`architecture-decisions.md`](./architecture-decisions.md#45-polymorphic-linked_meters--resolved-via-a-sql-view). |
| **Zod schemas** | Per entity, in `lib/validation/`. Reused by API route handlers and React Hook Form. |
| **Test harness** | Playwright config + `tests/e2e/fixtures` that boots a condo via the seed script. Each milestone adds one happy-path e2e test. |

---

## 3. Delivery Split (M0 → M10)

Ten milestones, each a 1–3 day vertical slice that ends in a working URL. Strict dependency order — don't reorder without re-checking what each step assumes is already in place.

### M0 — Foundations *(week 1, the "do the recommendation" milestone)*

The single initial PR that everything else builds on.

- Next.js 14 + TS + Tailwind + shadcn baseline (some of this exists in `reference-code/`).
- Drizzle wired up + the **full schema from `hidrosync_workflow.md §Data Model`** as the initial migration. Tempting to do incrementally, but the tables are tightly coupled (FKs everywhere) and the shape is already fully specified.
- NextAuth (Google + credentials) + a `users` row on first login.
- `modules/rbac` with `user_condo_grants` and `user_unit_grants` working end-to-end against a seeded admin.
- Audit log writer, GCS helper, EXIF parser, AI adapter interface (with mock).
- The `meter_scope_resolved` SQL view.
- Playwright config + one smoke test (login + see admin home).

**Exit criteria:** seeded sysadmin can log in, hit a stub `/admin/health`, perform one mutation, and a row lands in `audit_log`.

### M1 — Onboarding *(§1)*

- Temp tables `temp_groups`, `temp_units`, `temp_meters` scoped by an `onboarding_session_id`.
- `/onboarding` page: prompt textarea → preview table → confirm.
- "Prompt → structure" extractor lives behind an interface; ship with a deterministic mock + a shadcn-styled preview, real LLM call later.
- Logo upload (reuses `ingestPhoto`).

**Exit criteria:** condo admin pastes "10 floors, 4 apts each, 1 master per floor + 1 condo intake" and ends up with committed rows.

### M2 — Meters & QR *(§2)*

- `/meters` listing, grouped by `groups`.
- Server-side QR generation.
- Print grid view (CSS print stylesheet, configurable grouping).
- `/reading/:meterId` skeleton page that QR codes link to (validates meter belongs to current scope; capture flow comes in M4).

**Exit criteria:** print sheet renders correctly; scanning a printed QR opens the right meter page.

### M3 — Period state machine + scheduler *(§3)*

- `periods` table + transitions enforced in `modules/periods/transitions.ts`.
- Cron endpoint `/api/scheduler/tick` invoked daily by Cloud Scheduler.
- Per-condo `condo_config` honored for reading day / window / billing day.
- Notifications stubbed (log lines; real email/push later).

**Exit criteria:** advancing the clock (or hitting the endpoint with `?date=`) drives a condo through `scheduled → reading_open → review`.

### M4 — Reading capture (offline-first) *(§4)*

- `/reading/:meterId` capture flow: camera capture **and** gallery picker.
- EXIF extraction stored on the row.
- **AI value extraction via OpenRouter** — see [`meter-reading-pipeline.md`](./meter-reading-pipeline.md). Operator confirms or corrects the AI value.
- Offline queue (Service Worker + IndexedDB; sync on reconnect).
- Baseline rule: first reading per meter is its baseline.

**Exit criteria:** operator role captures readings online and offline; AI suggestion appears in the value field; readings show up correctly attached to the open period.

### M5 — Review & error catching *(§5)*

- Anomaly engine: delta vs. 6-month median, AI confidence floor, missing image, duplicate, EXIF outside period window.
- `/reading` listing with filters and per-row approve / correct / reject.
- CSV export of flagged readings.

**Exit criteria:** editor role can clear all flags, period is eligible to close.

### M6 — Closing & consumption *(parts of §3, §6)*

- `assertCanClose(periodId)` gate (no unresolved readings, no missing-without-decision).
- Admin actions for missing readings: estimate / carry-over / extend.
- Consumption computation per meter; common-area per master per scope (condo / group / custom unit set), backed by `meter_scope_resolved`.
- Period transition `review → closed`.

**Exit criteria:** consumption rows materialize; common-area numbers match a hand-computed example.

### M7 — Tenant portal *(§6 viewer side)*

- `/tenant` lists every owned unit across all condos for the logged-in viewer.
- Per-period history + photos + EXIF capture timestamp.
- Trend view + multi-unit aggregate.
- **Critical:** every query joins `user_unit_grants`. Add a `withViewerScope(userId)` helper and a Playwright test that asserts a viewer cannot see a unit they don't own.

### M8 — Billing export *(§7)*

- CSV writer with the agreed columns.
- `billing_exports` rows (versioned; never overwrite).
- `closed → billed → archived` transitions.

**Exit criteria:** admin downloads CSV, re-export emits a v2 row, both files retrievable.

### M9 — Lifecycle + reopen + audit UX *(Meter Lifecycle, §3 reopen, Audit Log)*

- Add / replace / retire meter flows (final-reading + new-baseline math validated).
- System-admin reopen flow (`archived → review`, recompute downstream periods, new versioned CSV after re-close).
- `/admin/audit` viewer (scoped to condo for condo admin, all-condos for sysadmin).

### M10 — Hardening & polish

- Per-unit threshold overrides (already specced in `condo_config`).
- Per-condo configuration UI.
- LGPD export/delete endpoints.
- Cold-storage migration script for photos older than `N` years.
- Monitoring, error reporting, rate limiting.

---

## Order Rationale

- Data model + RBAC first because everything else uses them.
- Onboarding next: it's the prerequisite for any subsequent feature.
- QR + reading capture before review because review needs data.
- Close + consumption before billing because billing needs consumption.
- Tenant portal can be parallel to billing (different surfaces), but we sequence it after for review simplicity.
- Lifecycle / reopen last because they are corrections on top of working flow.

---

## How to Use This Plan

- Treat each milestone as **one PR** (or a small chain of commits) merged before the next starts.
- Each milestone gets at least one Playwright e2e covering its happy path.
- Don't pull work forward across milestones — if you find yourself wanting to do M5 work during M3, that's a sign M3 is too thin and is a planning bug worth raising.
- Re-read [`architecture-decisions.md`](./architecture-decisions.md) before any decision that contradicts it; if you decide to deviate, update the decisions doc in the same PR.
