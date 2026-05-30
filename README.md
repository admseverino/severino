# Severino - Smart Meter Reading and Monitoring System

A modern, full-stack smart meter reading and monitoring system, built with Next.js, TypeScript, and a suite of Google Cloud services. The platform covers the complete meter reading and monitoring lifecycle — from meter reading to reading review and error catching to export and integration with external billing systems. These are some of the features:

- Onboarding experience to setup meters and tenants.
- Interface to manage meters, tenants and readings.
- Interface to export readings to external billing systems.
- Interface for tenants to watch their readings and monitor their consumption.
- Interface for user to read meters via image capture or upload.
- QR Code reading and validation via the website and using the device camera.

## Documentation

| Document | What it covers |
|---|---|
| [`severino_workflow.md`](./severino_workflow.md) | Product spec — roles, monthly cycle, data model, lifecycle |
| [`Infrastructure-plan.md`](./Infrastructure-plan.md) | GCP / Terraform plan (phase 1, dev only) |
| [`docs/development-plan.md`](./docs/development-plan.md) | Folder scaffold, cross-cutting foundations, milestone delivery (M0 → M10) |
| [`docs/architecture-decisions.md`](./docs/architecture-decisions.md) | Locked-in tech choices: Drizzle, period state machine, scheduler, polymorphic view |
| [`docs/meter-reading-pipeline.md`](./docs/meter-reading-pipeline.md) | QR detection + AI vision (OpenRouter) deep dive |

## Architecture Overview

The repository is a monorepo containing the main app, deployed to Google Cloud Run.

| Service | Directory | Description |
|---------|-----------|-------------|
| Main App | `severino-service/` | Next.js app: onboarding, meters, readings, consumption, billing |
| WhatsApp Webhook | `severino-webhook/` | Receives WhatsApp Cloud API webhooks (ingest + async worker on Cloud Run) |
| Redirect | `redirect-service/` | `www.*` → apex 301 redirect (added in phase 2) |

Additional services, jobs, and Cloud Functions can be added later as the platform grows. See [`Infrastructure-plan.md`](./Infrastructure-plan.md) for the GCP/Terraform plan.

### Database

| Database | Used by | Purpose |
|----------|---------|---------|
| `hidrosync-service` | Main App | Users, condos, meters, periods, readings, consumption, billing exports, audit log |

Single Cloud SQL Postgres instance per environment (dev / prod), with one logical database per service that needs persistence. See [`Infrastructure-plan.md`](./Infrastructure-plan.md) for the dev-environment details.

## Tech Stack

### Main App

- **Framework**: Next.js 14 (latest stable) with App Router
- **Language**: TypeScript 5.4 (latest stable)
- **Styling**: Tailwind CSS 3.4.2 (latest stable 3.x)
- **UI Components**: Radix UI + shadcn/ui patterns (latest stable)
- **Animations**: Framer Motion 11 (latest stable)
- **Authentication**: NextAuth.js 4.24 (latest stable 4.x)
- **Database**: PostgreSQL via node-postgres (`pg` 8.11.5 - latest stable)
- **ORM & Migrations**: Drizzle ORM + Drizzle Kit (latest stable) — typed schema-as-code, generated SQL migrations. See [`docs/architecture-decisions.md`](./docs/architecture-decisions.md#41-orm--migrations-drizzle).
- **Cloud Storage**: Google Cloud Storage (`@google-cloud/storage` 7.14.0 - latest stable)
- **AI — Meter Value Extraction**: [OpenRouter](https://openrouter.ai/) with **Gemini 2.5 Flash** as the default first-pass vision model; Claude Sonnet held in reserve for an escalation pass once we have real-world confidence data. See [`docs/meter-reading-pipeline.md`](./docs/meter-reading-pipeline.md).
- **AI — Onboarding Parser**: OpenRouter with **Claude Sonnet** for the prompt-driven condo setup (quality > cost since it runs once per condo).
- **QR Generation (printing)**: [`qrcode`](https://www.npmjs.com/package/qrcode) (server-side, SVG/PNG output).
- **QR Detection (scanning)**: [`jsQR`](https://github.com/cozmo/jsQR) — single library, platform-agnostic. We always print our own QR codes, so multi-format support is unnecessary.
- **Email**: [Resend](https://resend.com) + [React Email](https://react.email) for transactional templates.
- **Image Compression**: [`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression) (with [`heic2any`](https://github.com/alexcorvi/heic2any) for iPhone HEIC inputs).
- **Offline / PWA**: [`@serwist/next`](https://serwist.pages.dev/) for shell precaching + a bespoke IndexedDB queue with foreground sync (Background Sync API as belt-and-suspenders where supported).
- **Cron / Scheduling**: Google Cloud Scheduler → authenticated `/api/scheduler/tick` endpoint.
- **Form Handling**: React Hook Form 7.51.3 + Zod 3.22.4 (latest stable)
- **Icons**: Lucide React 0.312.0 (latest stable)
- **End-to-End Testing**: Playwright 1.43.1 (latest stable 1.x)
- **Deployment**: Docker (multi-stage) via Google Cloud Build and Cloud Run

## Getting Started

### Prerequisites

- Node.js 22+ (see root `engines` in [`package.json`](./package.json))
- [pnpm](https://pnpm.io/) 11.x (see root `packageManager` in [`package.json`](./package.json))
- PostgreSQL database (`hidrosync-service`)
- Google Cloud credentials (for GCS media uploads in development: `gcloud auth application-default login`)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd severino
```

2. Install dependencies (monorepo workspace):

```bash
pnpm install
```

3. Set up environment variables for the app:

```bash
cp severino-service/env.example severino-service/.env
# Also copy or symlink DATABASE_URL to the repo root `.env` if you run migrations from root
```

4. Set up the database (run migrations from [`packages/db`](./packages/db)):

```bash
pnpm run db:migrate
```

5. Seed a development system admin (interactive):

```bash
pnpm --filter severino-service run create-admin
```

6. Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Available Scripts

Root (`pnpm` from repo root):

- `pnpm dev` — ngrok in a separate Cursor terminal, then turbo (apps + webhook mirror/worker/ingest)
- `pnpm build` — Build all packages/apps
- `pnpm lint` — Lint via Turborepo
- `pnpm run db:generate` — Generate a Drizzle migration in `packages/db`
- `pnpm run db:migrate` — Apply migrations
- `pnpm run db:check` — Check migration drift

`severino-service`:

- `pnpm --filter severino-service run dev` — Next.js dev server
- `pnpm --filter severino-service run build` — Production build
- `pnpm --filter severino-service run start` — Start production server
- `pnpm --filter severino-service run lint` — ESLint
- `pnpm --filter severino-service run create-admin` — Create/update a `system_admin` user (interactive)

## Project Structure

```plaintext
severino/
├── packages/
│   └── db/                       # Workspace package: Drizzle schema + migrations (@severino/db)
├── severino-service/            # Main Next.js app (App Router)
│   ├── app/                      # Routes (route groups: (marketing), (app), api)
│   ├── components/               # React components (ui/, layout/, …)
│   ├── modules/                  # Server-side domain logic per bounded context
│   ├── lib/                      # App utilities (auth, validation, …)
│   ├── scripts/                  # create-admin, …
│   ├── tests/                    # unit/ and e2e/ (Playwright) — coming in M0b
│   ├── public/                   # Static assets
│   └── env.example               # Environment variable template
├── redirect-service/             # www → apex redirect service (phase 2)
├── docs/                         # Cross-cutting planning docs
│   ├── development-plan.md       # Folder scaffold + cross-cutting + milestones
│   ├── architecture-decisions.md # Locked-in tech choices
│   └── meter-reading-pipeline.md # QR + AI vision deep dive
├── severino_workflow.md         # Product spec
├── Infrastructure-plan.md        # GCP / Terraform plan
└── README.md                     # This file
```

For the full per-folder breakdown of `severino-service/`, see [`docs/development-plan.md`](./docs/development-plan.md#1-folder-scaffold-severino-service).

## Key Features

End-to-end smart-meter management built around a recurring monthly cycle. **Phase 1 covers water meters only.** For the full specification, see [severino_workflow.md](./severino_workflow.md).

### Authentication & User Profiles

Google OAuth or email + password (verification required for email accounts). Avatar and password editable from the profile page.

### Roles & Multi-Condo Support

Six roles — **System admin**, **Multi-condo admin**, **Condo admin**, **Operator**, **Editor**, **Viewer** (tenant) — granted per-condo (or per-unit for viewers). One account can hold any combination of roles across any number of condos; grants are additive.

### Prompt-Driven Onboarding

A single prompt describing the condo's structure (floors, towers, villas, blocks) populates `groups`, `units`, `meters`, and tenant links into **temp tables** the admin previews and validates before commit. Idempotent until committed; supports a condo logo upload reused on QR labels and the tenant portal.

### QR Code Interface

Each meter has a unique QR Code; the print view renders codes in a configurable grid grouped by floor/tower/block, branded with the condo logo, condo name, and unit string. Scanning from the device camera opens the matching reading screen pre-validated.

### Offline-First Meter Reading

Operators capture readings with the device camera **or pick photos from the gallery** (for no-signal areas). EXIF metadata (capture timestamp, GPS, device) is extracted and stored on the reading; AI extracts the value, the operator confirms. Captures queue locally and sync when connectivity returns.

### Monthly Reading Cycle

Each condo runs a recurring loop with a fixed state machine: `scheduled → reading_open → review → closed → billed → archived`. Timing, anomaly thresholds, and missing-reading defaults (estimate / carry-over / extend) are configurable per condo, with per-unit overrides. System admins can reopen archived periods when business requires.

### Review & Error Catching

Editors review each period in `/reading`. The system auto-flags implausible deltas, low AI-extraction confidence, missing images, duplicates, and stale photos (EXIF outside the period window). Flagged readings can be exported to CSV for offline auditing.

### Tenant Portal

Tenants log in to view **every unit they own** across all condos: full historical consumption with the reading photos backing each value. Read-only and unit-scoped. Paid/unpaid status is **not** tracked — that lives in the external billing system.

### Common-Area Consumption

Each condo can have **N master meters** (e.g. one per tower); common-area consumption is computed per master as `master − Σ(linked submeters)`. Visible to Condo admins and above.

### Billing Export

`/billing` produces a **versioned** CSV per period once `closed`. Severino stops at export — invoicing, dunning, and payment tracking belong to the external billing system.

### Meter Lifecycle

Add additional submeters per unit, add or replace master meters, swap a meter (final reading on the old, baseline on the new), or retire without replacement. History is preserved in every case.

### Audit Log

Every state transition and value edit (period changes, reading edits, missing-reading overrides, period reopens, role grants, meter add/replace/retire) writes an immutable row with `actor`, `before`, `after`, and `reason`. Append-only, with scoped read access per role.

### Data Retention & Privacy

Reading photos retained in active GCS for a configurable period (default 5 years), then moved to cold storage. Values, consumption, billing exports, and audit log retained indefinitely. LGPD-compliant tenant data export and deletion (PII redacted, consumption rows preserved anonymized).

## Environment Variables

Configure these in your `.env` file (see `env.example`):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string for the `hidrosync-service` database |
| `NEXTAUTH_URL` | Public URL of the application |
| `NEXTAUTH_SECRET` | NextAuth.js secret key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (optional) |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | Base URL for media served from GCS (e.g. `https://media.severi.no/`) |
| `NEXT_PUBLIC_BASE_URL` | Public application URL |
| `OPENROUTER_API_KEY` | API key for OpenRouter (shared by meter-reader + onboarding-parser) |
| `OPENROUTER_METER_MODEL` | Vision model for meter-value extraction (default: `google/gemini-2.5-flash`) |
| `OPENROUTER_ONBOARDING_MODEL` | Text model for onboarding-prompt parsing (default: `anthropic/claude-sonnet-4`) |
| `AI_METER_READER` | `openrouter` or `mock` — dev/tests use `mock` |
| `AI_ONBOARDING_PARSER` | `openrouter` or `mock` — dev/tests use `mock` |
| `RESEND_API_KEY` | API key for Resend transactional email |
| `EMAIL_FROM` | Sender address for outgoing email (e.g. `noreply@severi.no`) |
| `SCHEDULER_OIDC_AUDIENCE` | Audience claim Cloud Scheduler signs `/api/scheduler/tick` calls with |
| `NODE_ENV` | `development` or `production` |

In development, GCS access uses Application Default Credentials (`gcloud auth application-default login`). In production (Cloud Run), credentials are provided automatically by the service account attached to the Cloud Run service.

## Deployment

All services are deployed to Google Cloud Run via Cloud Build pipelines. Each service has its own `cloudbuild.yaml`.

### Main App

The Dockerfile uses a three-stage build:

1. **deps** — installs npm dependencies (Node.js 20 Alpine + native PostgreSQL build tools)
2. **builder** — compiles the Next.js app in standalone mode
3. **runner** — minimal production image; copies only the standalone output and static files

Cloud Build (`severino-service/cloudbuild.yaml`) builds the image, pushes it to Artifact Registry, and deploys to Cloud Run with:

- 1 CPU, 1 GiB memory
- 0 minimum instances, up to 10 instances
- Cloud SQL connector (`--add-cloudsql-instances`) for private database access
- All secrets and environment variables injected via `--set-env-vars`
- A pre-deploy step runs `npm run db:migrate` against the target instance

### Redirect Service

A lightweight Express server deployed as a Cloud Run service from `redirect-service/`. Issues 301 permanent redirects from `www.severi.no` to `severi.no` (and any other `www.*` subdomain to its apex equivalent).

## Scripts and Migrations

Each service owns the setup and migration scripts for the database it primarily manages.

### `severino-service/drizzle/` (schema + migrations)

- `schema/` — Drizzle schema files, one per bounded context (`condos.ts`, `meters.ts`, `readings.ts`, …)
- `migrations/` — generated SQL migrations, committed to git. Apply with `npm run db:migrate`.
- `views/` — hand-written migrations for SQL views (notably `meter_scope_resolved`, which flattens the polymorphic `linked_meters` table). See [`docs/architecture-decisions.md`](./docs/architecture-decisions.md#45-polymorphic-linked_meters--resolved-via-a-sql-view).

### `severino-service/scripts/`

- `create-admin.ts` — create a System admin account interactively
- `seed-dev.ts` — load a small fixture (one condo, a few units, a sysadmin) for local development

## License

This project is private and proprietary.

---

Proudly built by Dirceu Corsetti
