# Data Model (Drizzle, in `@severino/db`)

The only part of `severino-webhook` that is **not** self-contained is persistence. Per the
monorepo's locked-in decision (see
[`docs/architecture-decisions.md` §4.1](../../docs/architecture-decisions.md)), **all schema and
migrations live in the shared `@severino/db` package** ([`packages/db`](../../packages/db)). The
webhook service depends on that package and imports the typed client and schema; it never opens
its own pool or defines tables locally.

This keeps one DB boundary for the whole monorepo and lets downstream services
(`severino-service`) read the same tables with the same types.

## Where the files go

Following the existing per-bounded-context convention
([`packages/db/src/schema/*.ts`](../../packages/db/src/schema) + barrel `index.ts`):

```
packages/db/src/schema/
  whatsapp.ts        # NEW — tables below
  index.ts           # add:  export * from './whatsapp.js'
```

Migrations are generated the usual way and committed:

```bash
pnpm run db:generate   # drizzle-kit generate (creates SQL under packages/db/migrations)
pnpm run db:migrate    # apply
```

No new tooling — exactly the workflow in [`docs/SCHEMA.md`](../../docs/SCHEMA.md).

## Two tables

### 1. `whatsapp_events` — raw, append-only envelope

The exact bytes Meta sent us, stored **before** any parsing. This is our durable buffer and our
replay source (Meta does not let you re-query historical webhook data). Append-only; never
updated except to flip processing markers.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK (`gen_random_uuid()::text`) | internal event id, used as the Pub/Sub message body |
| `signature` | `text` | the `X-Hub-Signature-256` header, for audit |
| `payload` | `jsonb` | the parsed-once JSON body (stored as-is; signature was already verified on raw bytes) |
| `raw_body` | `text` | optional: exact raw body string, for byte-perfect replay |
| `received_at` | `timestamptz` notNull default now | when ingest accepted it |
| `processed_at` | `timestamptz` nullable | set by the worker when normalization succeeds |
| `process_error` | `text` nullable | last parse/normalize error, for the dead-letter view |
| `process_attempts` | `integer` notNull default 0 | incremented per worker attempt |

Index: `received_at` (sweep/reconciliation), partial index `WHERE processed_at IS NULL`
(find un-processed events cheaply for the reconciliation sweep).

### 2. `whatsapp_messages` — normalized, deduplicated inbound messages

One row per WhatsApp message, extracted from an event. The **`wamid` is the dedup key**.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK (`gen_random_uuid()::text`) | internal id |
| `event_id` | `text` FK → `whatsapp_events.id` `onDelete: restrict` | provenance |
| `wamid` | `text` notNull **unique** | WhatsApp message id (`wamid.*`); makes redelivery a no-op |
| `waba_id` | `text` | the `entry[].id` (business account) |
| `phone_number_id` | `text` notNull | `value.metadata.phone_number_id` — which of our numbers received it |
| `from_msisdn` | `text` notNull | `messages[].from` (sender, E.164 digits) |
| `contact_name` | `text` nullable | `contacts[].profile.name` if present |
| `message_type` | `whatsapp_message_type` enum notNull | `text`, `image`, … (see below) |
| `text_body` | `text` nullable | convenience copy of `text.body` for text messages |
| `payload` | `jsonb` notNull | the full `messages[]` object, untouched (type-specific fields live here) |
| `wa_timestamp` | `timestamptz` notNull | from `messages[].timestamp` (unix seconds → date) |
| `status` | `whatsapp_processing_status` enum notNull default `received` | our internal processing state |
| `created_at` | `timestamptz` notNull default now | |
| `updated_at` | `timestamptz` notNull default now | |

Enums (mirrors `pgEnum` usage in
[`packages/db/src/schema/readings.ts`](../../packages/db/src/schema/readings.ts)):

```ts
export const whatsappMessageTypeEnum = pgEnum('whatsapp_message_type', [
  'text', 'image', 'audio', 'video', 'document', 'sticker',
  'location', 'contacts', 'button', 'interactive', 'reaction',
  'order', 'system', 'unknown',
])

export const whatsappProcessingStatusEnum = pgEnum('whatsapp_processing_status', [
  'received',     // row written
  'handled',      // downstream effect done
  'ignored',      // intentionally not actionable (e.g. a status receipt)
  'failed',       // downstream effect threw; eligible for retry
])
```

Indexes:

- **`unique(wamid)`** — the idempotency guarantee. Worker upserts with `ON CONFLICT (wamid) DO
  NOTHING`. See [`concurrency-and-scaling.md`](./concurrency-and-scaling.md).
- `index(phone_number_id, wa_timestamp)` — list a conversation/number chronologically.
- `index(from_msisdn, wa_timestamp)` — per-sender history.
- partial `index WHERE status = 'failed'` — retry/inspection.

> **Statuses (delivery receipts):** `value.statuses[]` are outbound delivery/read receipts.
> They are stored raw inside `whatsapp_events.payload`; if we later need to surface them we add a
> small `whatsapp_message_statuses` table. For now the normalizer skips them (marks the event
> handled). Keeping them out of `whatsapp_messages` avoids mixing inbound content with outbound
> receipts.

## Sketch of `whatsapp.ts`

This is a **spec sketch**, not committed code — it shows the intended shape and follows the
existing schema style (text UUID PKs, `timestamptz` with `mode: 'date'`, `pgEnum`).

```ts
import { sql } from 'drizzle-orm'
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const whatsappMessageTypeEnum = pgEnum('whatsapp_message_type', [/* …as above… */])
export const whatsappProcessingStatusEnum = pgEnum('whatsapp_processing_status', [/* …as above… */])

export const whatsappEvents = pgTable('whatsapp_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  signature: text('signature'),
  payload: jsonb('payload').notNull(),
  rawBody: text('raw_body'),
  receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
  processError: text('process_error'),
  processAttempts: integer('process_attempts').notNull().default(0),
}, (t) => [
  index('whatsapp_events_received_at').on(t.receivedAt),
  index('whatsapp_events_unprocessed').on(t.receivedAt).where(sql`${t.processedAt} is null`),
])

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  eventId: text('event_id').notNull().references(() => whatsappEvents.id, { onDelete: 'restrict' }),
  wamid: text('wamid').notNull(),
  wabaId: text('waba_id'),
  phoneNumberId: text('phone_number_id').notNull(),
  fromMsisdn: text('from_msisdn').notNull(),
  contactName: text('contact_name'),
  messageType: whatsappMessageTypeEnum('message_type').notNull(),
  textBody: text('text_body'),
  payload: jsonb('payload').notNull(),
  waTimestamp: timestamp('wa_timestamp', { withTimezone: true, mode: 'date' }).notNull(),
  status: whatsappProcessingStatusEnum('status').notNull().default('received'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('whatsapp_messages_wamid').on(t.wamid),
  index('whatsapp_messages_number_ts').on(t.phoneNumberId, t.waTimestamp),
  index('whatsapp_messages_from_ts').on(t.fromMsisdn, t.waTimestamp),
])
```

## Inferred types (the type-safety payoff)

Drizzle infers row types straight from the table, so the webhook code never declares a separate
DB interface:

```ts
import type { whatsappMessages } from '@severino/db/schema'
type WhatsAppMessageRow = typeof whatsappMessages.$inferSelect
type NewWhatsAppMessageRow = typeof whatsappMessages.$inferInsert
```

These are distinct from the **wire types** produced by the Zod parser (the shape Meta sends). The
worker's normalizer is the single function that maps `WhatsAppChangeBatch` (wire) →
`NewWhatsAppMessageRow` (DB). Keeping those two type families separate is deliberate: Meta's
payload and our storage are allowed to evolve independently. See
[`type-safety.md`](./type-safety.md).

## Connection / pooling

The webhook uses the package's `db()` client and shared pool config
([`packages/db/src/client.ts`](../../packages/db/src/client.ts),
[`pool-config.ts`](../../packages/db/src/pool-config.ts)). Note the existing `max` connections
are tuned for the Next.js app (`5` in prod). Because the webhook runs as its **own** Cloud Run
service with its own instances, see
[`concurrency-and-scaling.md`](./concurrency-and-scaling.md) for why we keep per-instance pools
small and lean on Pub/Sub for backpressure rather than a huge connection count.
