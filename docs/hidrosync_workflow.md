# HidroSync Workflow

End-to-end flow from condo onboarding to billing export. Setup (sections 1–2) runs **once per condo**; everything from section 3 onward **repeats every month**. Every action is gated by user role — see [Roles & Permissions](#roles--permissions). **Phase 1 covers water meters only**; the meter-type field is reserved in the data model for future utilities.

## Glossary

- **Condo** — the property under management. Has its own configuration, branding, and roles.
- **Group** — a structural subdivision of a condo (floor, tower, block, villa cluster). Used for grouping units in listings and prints.
- **Unit** — an addressable space inside a condo (e.g. `1004B`, `Casa-12`); identified by a string.
- **Tenant** — the human owner/occupant of a unit. Modeled as a user account with a **Condo viewer** grant on each owned unit (no separate `tenants` table).
- **Meter** — a device that produces a numeric reading. Two kinds:
  - **Submeter** — linked to a unit; produces per-unit consumption.
  - **Master meter** — measures the total flow into a defined **scope**. A master can be linked to **the condo** (whole-property intake), a **group** (e.g. a tower or a floor riser), or a **custom set of units**. A condo can have **N master meters at any combination of scopes** — typical setups have one condo-level master plus one per tower or per floor.
- **Linked meters** — **polymorphic** N-to-N between meters and a target scope. Submeters link to **units**; master meters link to **groups**, to the **condo**, or to a custom set of units. Supports shared meters, multiple meters per unit, and master meters at any structural level.
- **Reading** — a single captured value with photo, EXIF metadata, timestamp, and operator. The **first reading** for any meter is automatically its **baseline**.
- **Period** — a monthly cycle keyed by `(condo_id, year, month)`, with a fixed state machine.
- **Consumption** — `current_reading.value − previous_reading.value` for the same meter.
- **Common-area consumption** — for each master, computed as `master.consumption − Σ(submeters within that master's scope).consumption` for the same period. The scope follows the master's link target (whole condo, a specific group, or a custom unit set), so each master produces an independent common-area number for its own coverage.
- **Billing** — a CSV export of period consumption for the external billing system. Paid/unpaid status, invoices, and dunning live entirely in the external system; HidroSync does not track them.
- **Audit log** — the append-only record of every state transition and value edit.

## Roles & Permissions

HidroSync defines six roles, scoped from the platform down to a single unit. Higher roles inherit all abilities of lower roles **within their scope**. One user account can hold **any combination of roles across any number of condos** — grants are additive, never mutually exclusive.

| Role                  | Scope             | Can do                                                                                            |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| **System admin**      | Platform-wide     | Everything across all condos, including creating condos, assigning multi-condo admins, and reopening archived periods. |
| **Multi-condo admin** | Assigned condos   | Everything inside their assigned condos: onboarding, meters, periods, billing, user management.   |
| **Condo admin**       | One condo         | Onboard the condo, manage groups/units/meters/tenants, run and close periods, export billing.     |
| **Condo operator**    | One condo         | Capture readings ([§4](#4-meter-reading)). Cannot review, edit, close, or export.                 |
| **Condo editor**      | One condo         | Review and edit readings ([§5](#5-reading-review--error-catching)). Cannot close periods or export billing. |
| **Condo viewer**      | One or more owned units (tenant) | View consumption history and reading photos for **each unit they own** ([§6](#6-consumption--tenant-portal)). Read-only. Granted **per-unit**, so the same account can own multiple units in one condo, across several condos, or both. |

Hierarchy:

```text
System admin ▶ Multi-condo admin ▶ Condo admin ▶ { Condo operator, Condo editor } ▶ Condo viewer
```

Notes:

- **Operator** and **Editor** are parallel roles — neither inherits the other. A user who needs both abilities is simply **granted both** in the same condo; promotion to **Condo admin** is reserved for cases that also need close/export rights.
- **Condo viewer** is the meter's owner (the tenant). The grant is **per-unit**, so a single user account can own **any number of units** — in the same condo, across different condos, or both. They see only the units they own; nothing else in the condo is visible to them.
- Role grants are stored **per-user per-scope** — per-condo for admin/operator/editor, **per-unit for viewers**. A user can hold **multiple roles in the same condo** (e.g. operator + editor), **different roles in different condos** (e.g. admin in condo A, operator in condo B), and **own units anywhere** — all on the same account.
- Effective permissions for a request = **union of all grants** the user holds for the relevant condo or unit.

Examples this allows:

- A field technician who is **operator in condo A** and **operator + editor in condo B**.
- A property manager who is **multi-condo admin** for buildings X, Y, Z and also a **condo viewer** for the apartment they personally own in building W.
- A landlord who is **viewer** on three units across two different condos, with no admin/operator/editor role anywhere.

## 1. Onboarding (Prompt-Driven Setup)

**Who:** Condo admin (and above).

A single user prompt describes how the condo is divided (floors, towers, villas, blocks, etc.) and drives the entire setup.

- `groups` table is populated from the structural breakdown described in the prompt.
- `units` table is populated with unit identifiers as **strings** (e.g. `1004B`, `Casa-12`).
- `meters` table is seeded with **one submeter per unit** by default. **Master meters** (one or more) are added separately and linked to a **scope**: the whole condo, a specific group (tower, floor, block, etc.), or a custom set of units — see [Meter Lifecycle](#meter-lifecycle).
- `linked_meters` join table is **polymorphic N-to-N**: each row links a meter to a target — `unit`, `group`, or `condo`. Onboarding fills `unit ↔ submeter` rows 1-to-1, but the structure also supports shared submeters, multiple meters per unit, and master meters at the group or condo level.
- A **condo logo** can be uploaded during onboarding (stored in GCS like reading photos) and is used on QR labels ([§2](#2-qr-code-interface)) and in the tenant portal header ([§6](#6-consumption--tenant-portal)). Logo path is kept in [Condo Configuration](#condo-configuration).

Rules:

- Initial inserts land in **temp tables** scoped to the onboarding session.
- Re-running the prompt fully regenerates the temp tables — onboarding is idempotent until committed.
- User reviews the preview and validates; on confirmation, data is committed to the **permanent condo tables**.
- Tenants are linked to units after commit (invite by email, or import). A tenant can be linked to **any number of units** in the same import, and is granted **Condo viewer** on each one. Subsequent condos can reuse the same tenant account by email — additional units simply add new viewer grants to the existing account.
- **No separate baseline step**: the **first reading** captured against any meter automatically becomes that meter's baseline. Consumption is undefined until a meter has at least two readings.

## 2. QR Code Interface

**Who:** Condo admin manages and prints; Condo operator uses the scanner in the field.

Every meter has a unique QR Code used for fast on-site capture.

- A grouped listing shows all units and meters, grouped by `groups`.
- Print view renders QR Codes in a configurable grid:
  - User picks the grouping (floor, tower, block, etc.).
  - Each label shows: **condo logo** (if set), **condo name**, **unit string**, and — when more than one meter is linked to a unit — an extra line with the **meter id**.
  - **Master meters** print on their own page, labeled with their **scope**: `Master — Condo intake` for condo-level masters, or `Master — <group name>` for group-level masters (e.g. `Master — Tower A`, `Master — Floor 5`). No unit string is shown.
- Scanning a QR Code from the website (device camera) opens that meter's reading screen, pre-validated against the condo and unit/master.

## 3. Monthly Reading Cycle

**Who:** Scheduler (automation) drives state transitions; Condo admin overrides missing readings and triggers close/export; **System admin** can reopen archived periods.

Once onboarding is committed, the condo enters a recurring monthly loop. Each iteration is a `period` row keyed by `(condo_id, year, month)` that progresses through a fixed state machine. The mechanics of each phase are detailed in [§4](#4-meter-reading)–[§7](#7-billing--external-integration); this section is the orchestration on top of them.

### States

`scheduled` → `reading_open` → `review` → `closed` → `billed` → `archived`

### Timeline (configurable per condo via [Condo Configuration](#condo-configuration))

| Day (relative)    | What happens                                          | New state      |
| ----------------- | ----------------------------------------------------- | -------------- |
| Period start      | Scheduler creates the next period from condo config   | `scheduled`    |
| Reading day       | Reading window opens; operators are notified          | `reading_open` |
| Reading day + N   | Reading window closes; anomalies surfaced             | `review`       |
| Review day + M    | All anomalies resolved; consumption computed          | `closed`       |
| Close + export    | Billing CSV generated and exported to external system | `billed`       |
| End of cycle      | Period locked and snapshotted; next period scheduled  | `archived`     |

### Automation

- A scheduler creates the **next period** automatically based on each condo's config (reading day, review SLA, billing day) — no manual rollover.
- Reminders are pushed to **operators** when the reading window opens and again before deadline.
- **Viewers** (tenants) are notified **per owned unit** when a new period's consumption becomes available. Viewers who own multiple units receive either one notification per unit or a single digest, configurable in their account preferences.
- Missing readings at close time are surfaced to the **Condo admin**, who can: (a) **estimate** from the unit's history, (b) **carry over** (zero consumption now, corrected next period), or (c) **extend** the window. Defaults come from [Condo Configuration](#condo-configuration).
- **Anomaly thresholds** (delta percentage, OCR confidence floor) are configurable per condo, with optional **per-unit overrides** for unusual cases (vacant units, irrigation lines, hot-water submeters, etc.) — see [Condo Configuration](#condo-configuration).

### Guarantees

- **One reading per meter per period** — enforced by a unique `(meter_id, period_id)` constraint.
- **Consumption** = `current_reading.value − previous_reading.value` for the same meter; undefined if the meter has no prior reading (i.e. its first cycle).
- Once a period is `closed`, its readings are **immutable**; corrections become adjustment entries on the next open period.
- Once a period is `billed`, exports are **versioned**; re-exporting emits a new versioned CSV without overwriting the previous one.
- A period cannot be `closed` while any reading is unresolved or any meter has no reading and no admin decision.

### Reopening an Archived Period

Business reality occasionally requires reopening (legal dispute, late-found error, regulatory request).

- **Who:** System admin only.
- **What happens:** the period transitions `archived → review`; later periods that consumed its `previous_reading` are recomputed; the original billing CSV stays in history and a new versioned CSV is produced after re-close.
- **Trace:** every reopen writes an entry to the [Audit Log](#audit-log) with `actor`, `reason`, and the diff of values changed.

## 4. Meter Reading

**Who:** Condo operator (and above).

Operators capture readings in the field via `/reading` while the period is in `reading_open`. The flow is **offline-first**: captures queue locally and sync when connectivity returns.

1. Scan the meter QR Code (or pick from the grouped list).
2. Provide the photo:
   - **Capture** with the device camera, **or**
   - **Pick one or more from the device gallery** — useful when the meter sits in a no-signal area (basement, parking garage) and the operator photographed the meter earlier.
3. The image is uploaded to GCS and **photo metadata is extracted** from EXIF and persisted with the reading: capture timestamp, GPS coordinates (if present), device, orientation. The reading uses the **EXIF capture timestamp** as the source of truth for "when the meter was actually read", falling back to the upload timestamp if EXIF is missing.
4. AI extracts the numeric reading; operator confirms or corrects it.
5. Reading is persisted with: meter id, **period id**, value, EXIF capture timestamp, upload timestamp, GPS, device, image reference, operator.

**Baseline:** the **first reading** persisted for any meter is its baseline; until a second reading exists, that meter contributes no consumption to its unit.

## 5. Reading Review & Error Catching

**Who:** Condo editor (and above).

- `/reading` lists all readings of the open period, filterable by group, unit, and status.
- The system flags anomalies automatically using thresholds defined in [Condo Configuration](#condo-configuration):
  - **Implausible delta** vs. last period (default ±300% of unit's 6-month median; overridable per condo, then per unit).
  - **OCR confidence** below the configured floor.
  - **Missing image**.
  - **Duplicate readings** for the same meter in the same period.
  - **EXIF capture timestamp outside the period window** (likely stale photo from a previous month's gallery pick).
- Reviewer approves, corrects, or rejects; rejected readings stay open until resolved, or until the **Condo admin** picks estimate/carry-over at close time.
- Flagged readings can be exported to CSV for offline auditing.

## 6. Consumption & Tenant Portal

**Who:** Condo viewer (owned units only, across any condos); Condo admin and above see all units in their condo plus master-meter and common-area data.

- `/consumption` aggregates approved readings into per-unit consumption for the closed period.
- **Common-area consumption** is computed **per master meter**, scoped to that master's link target:
  - **Condo-level master**: `master − Σ(all submeters in the condo)`.
  - **Group-level master**: `master − Σ(submeters whose units belong to that group)` — e.g. one master per tower yields per-tower common-area; one per floor yields per-floor common-area.
  - **Custom-set master**: `master − Σ(submeters in the master's linked unit set)`.

  Each master produces an **independent** common-area number for its own coverage; a condo with N masters gets N parallel calculations. Visible to **Condo admin and above** only.
- Tenants log in to a portal listing **every unit they own**, grouped by condo. The portal shows the **full history** since onboarding:
  - **Per period**: consumption value, the reading photos that back it, and the EXIF capture timestamp.
  - **Trend view**: month-over-month consumption with anomalies highlighted.
  - **Unit switcher** to drill into a single unit; **"all units" view** for tenants who own more than one (aggregated totals + per-unit breakdown).
- HidroSync **does not track paid/unpaid status, invoices, or amounts due**. Billing lives entirely in the external system; the tenant portal shows **consumption history and reading photos only**.
- Access is enforced **unit-by-unit**: a viewer can never see a unit they do not own, even one in the same condo or building. The query layer joins `user_unit_grants` on every consumption/reading lookup.

## 7. Billing & External Integration

**Who:** Condo admin (and above).

- `/billing` produces the period's billing artifact from consumption once the period is `closed`.
- **Export only**: a CSV download in the format expected by the external billing system → period transitions to `billed`. HidroSync's billing role ends here.
- **No reconciliation import** in phase 1. Paid/unpaid status, dunning, late fees, and tenant invoices are entirely owned by the external billing system.
- Errors and unresolved readings block a period from being closed.

## Meter Lifecycle

Meters are not static. The lifecycle below preserves consumption-math correctness across changes.

### Adding a meter

- **Second meter on a unit** (e.g. unit gets a hot-water submeter): a new `linked_meters` row is created. The new meter's first reading is its **baseline**; until a second reading exists, it does not contribute to the unit's consumption.
- **Master meter**: a condo can have **N master meters at any combination of scopes** — at the **condo level** (whole-property intake), at the **group level** (one per tower, per floor riser, per block, per villa cluster), or scoped to a **custom set of units**. Each master is linked via a `linked_meters` row whose target is the chosen scope (`condo`, `group`, or `unit`), and its common-area consumption is computed against the submeters reachable from that scope.

### Replacing a meter (swap)

When a meter is physically swapped:

1. **Final reading** is captured on the **old meter** with the in-field reading (handled like any other reading, but the operator marks it as "final").
2. The old meter is set to `retired`; new readings against it are blocked.
3. **New meter** is created, linked to the same unit (or condo, for masters), and its **first reading is its baseline**.
4. Consumption for that unit/master in the active period = `final_reading(old) − previous_reading(old)`; the new meter contributes from the **next** period onward.

### Retiring a meter

- A meter can be retired without replacement (unit demolished, line capped). Retired meters keep their full reading history but are excluded from period generation and anomaly checks.

All lifecycle events (add, replace, retire) write entries to the [Audit Log](#audit-log) with the operator and reason.

## Audit Log

Every action that mutates business-critical state writes an **immutable** row to the audit log:

| Field       | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `actor`     | User id and role grant under which the action was performed |
| `entity`    | What was touched (period, reading, meter, grant, condo, etc.) |
| `action`    | `created` / `updated` / `state_changed` / `reopened` / `overridden` / `retired` |
| `before`    | JSON snapshot of the entity before the change               |
| `after`     | JSON snapshot of the entity after the change               |
| `reason`    | Free-text reason — **required** for overrides and reopenings |
| `timestamp` | UTC timestamp of the action                                 |

Covered events include: state transitions on a period, value edits to a reading, missing-reading admin decisions (estimate/carry-over/extend), period reopening, role-grant changes, and meter add/replace/retire.

The log is **append-only**; rows cannot be edited or deleted from the application. **System admin** can read the log across all condos; **Condo admin** can read entries scoped to their condo.

## Condo Configuration

Per-condo settings live on the `condo_config` row and are editable by **Condo admin and above**:

| Setting                   | Description                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `logo_image`              | GCS path to the condo logo (shown on QR labels and in the tenant portal header)              |
| `reading_day`             | Day of the month the reading window opens                                                    |
| `reading_window_days`     | How many days the window stays open                                                          |
| `review_sla_days`         | Maximum days from `review` start to `closed`                                                 |
| `billing_day`             | Day of the month the billing CSV is generated and exported                                   |
| `delta_threshold_pct`     | Anomaly flag if a reading deviates more than X% from the unit's 6-month median (default 300) |
| `ocr_confidence_floor`    | Minimum OCR confidence below which an automatic flag is raised (default 0.7)                 |
| `missing_reading_default` | Default policy at close time: `estimate`, `carry_over`, or `extend`                          |
| `extend_default_days`     | If `extend` is the default, how many days to extend by                                       |

**Per-unit overrides** are supported for `delta_threshold_pct` (vacant units, irrigation lines, hot-water submeters, etc.). Unit overrides take precedence over the condo default; condo settings take precedence over platform defaults.

## Data Retention & Privacy

- **Reading photos** are retained in active GCS for **N years** (configurable, default 5) to cover billing-dispute statutes; after that, they move to GCS cold-line storage.
- **Reading values, consumption, billing exports, and audit log** are retained indefinitely for accounting traceability.
- **Tenant accounts** can request data export and deletion under LGPD; deletion redacts personal fields (name, email, phone) but preserves consumption rows for accounting integrity (referenced by anonymized `unit_id` only).
- Access to photos and tenant data is gated by the same role grants that govern the rest of the system; viewers see only their own units' photos and history.

## Data Model

A condo's data lives in the following tables. Names are indicative; primary/foreign keys are implied.

| Table               | Purpose                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `condos`            | The condo itself (name, slug).                                                                                         |
| `condo_config`      | Per-condo settings (timeline, anomaly thresholds, logo, missing-reading defaults).                                     |
| `groups`            | Structural subdivisions of a condo (floor, tower, block, etc.).                                                        |
| `units`             | Addressable spaces, identified by string.                                                                              |
| `meters`            | Devices producing readings. Has `kind` (`submeter` or `master`), `status` (`active` / `retired`), and reserved `utility` field (phase 1 = `water`). |
| `linked_meters`     | Polymorphic N-to-N: `(meter_id, target_kind, target_id)` where `target_kind` is `unit` / `group` / `condo`. Submeters point to units; masters point to groups, the condo, or a set of units. |
| `users`             | User accounts (auth, profile).                                                                                         |
| `user_condo_grants` | Per-condo role grants (admin / operator / editor / multi-condo admin). Multiple rows per `(user, condo)` allowed.      |
| `user_unit_grants`  | Per-unit viewer grants for tenants. Multiple rows per user supported (one per owned unit).                             |
| `periods`           | Monthly cycle rows, keyed by `(condo_id, year, month)`, with state.                                                    |
| `readings`          | Captured values with photo, EXIF, operator, and period.                                                                |
| `consumption`       | Per-meter, per-period consumption (`current − previous`). Common-area derived per master meter.                        |
| `billing_exports`   | Versioned CSV exports per period (one row per export attempt; previous versions preserved).                            |
| `audit_log`         | Append-only record of all mutating actions.                                                                            |

## Data Lifecycle

```text
Onboarding (one-time, Condo admin) ──► QR Codes
                              │
                              ▼
       ┌─────────── Monthly Cycle (loop) ────────────┐
       │  scheduled → reading_open → review →        │
       │  closed → billed → archived                 │
       │                                             │
       │  operator ─► editor ─► admin                │
       └─────────────────────────────────────────────┘
                              │
                              ▼
                    Next period auto-created
```

Each loop produces an immutable, auditable snapshot per condo per month, with photos retained for the configured period and consumption history kept indefinitely.
