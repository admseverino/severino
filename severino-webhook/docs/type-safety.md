# Type Safety

The service must be **type-safe end to end**: nothing untyped should reach the database, and the
two type families (what Meta sends vs. what we store) must stay explicitly separated. This mirrors
the repo's existing "validate with Zod before any DB write" stance
([`docs/architecture-decisions.md` §4.7](../../docs/architecture-decisions.md)).

## The three boundaries

```
   Meta JSON ──[Zod parse]──▶ Wire types ──[normalize]──▶ DB row types ──[Drizzle]──▶ Postgres
   (unknown)                  (validated)                 ($inferInsert)
        ▲                          ▲                            ▲
   untrusted bytes          severino-webhook            @severino/db (inferred)
```

1. **Wire boundary (Zod).** Meta's payload is untrusted JSON. It is parsed by Zod schemas in
   `whatsapp/schema.ts` into **wire types**. Nothing past this line handles raw `unknown`.
2. **Normalize boundary.** `whatsapp/normalize.ts` is the single function that maps wire types →
   **DB insert types**. It is pure and unit-tested.
3. **DB boundary (Drizzle).** Insert/select types are **inferred from the schema** in
   `@severino/db` (`$inferInsert` / `$inferSelect`). We never hand-write a row interface.

Keeping wire types and DB types distinct means Meta can add/rename fields and our storage doesn't
have to move in lockstep — the change is absorbed in `schema.ts` + `normalize.ts` only.

## Zod at the wire boundary

The schemas are **strict on what we depend on, lenient on the rest** (Meta evolves payloads):

```ts
// whatsapp/schema.ts  (spec sketch — not committed)
import { z } from 'zod'

const WhatsAppMessage = z.object({
  id: z.string().min(1),          // wamid — required, this is our dedup key
  from: z.string().min(1),        // required
  timestamp: z.string().min(1),   // unix seconds as string — required
  type: z.string(),               // kept as string; mapped to enum in normalize
}).passthrough()                  // keep unknown/type-specific fields in `payload`

const WhatsAppValue = z.object({
  messaging_product: z.literal('whatsapp').optional(),
  metadata: z.object({ phone_number_id: z.string(), display_phone_number: z.string().optional() }),
  contacts: z.array(z.object({
    wa_id: z.string(),
    profile: z.object({ name: z.string() }).partial().optional(),
  })).optional(),
  messages: z.array(WhatsAppMessage).optional(),
  statuses: z.array(z.unknown()).optional(),   // receipts: stored raw, not normalized
}).passthrough()

export const WhatsAppWebhookBody = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({ field: z.string(), value: WhatsAppValue })),
  })),
})

export type WhatsAppWebhookBody = z.infer<typeof WhatsAppWebhookBody>
```

Rules:

- **`.passthrough()`** (not `.strict()`) on Meta objects: an unexpected new field must never crash
  ingestion. Unknown data is preserved in the raw envelope (`whatsapp_events.payload`) and in the
  message `payload jsonb`.
- **Per-entry resilience:** parse failures are recorded per entry/message against the
  `whatsapp_events` row; one bad message never discards a whole 1000-update batch (see
  [`whatsapp-integration.md`](./whatsapp-integration.md)).
- `safeParse`, never `parse`-that-throws on the hot path — failures are data, not exceptions.

## DB types inferred, not declared

```ts
import type { whatsappMessages, whatsappEvents } from '@severino/db/schema'

export type WhatsAppMessageRow = typeof whatsappMessages.$inferSelect
export type NewWhatsAppMessageRow = typeof whatsappMessages.$inferInsert
export type WhatsAppEventRow = typeof whatsappEvents.$inferSelect
```

`normalize.ts` returns `NewWhatsAppMessageRow[]`, so the compiler guarantees the mapping matches
the table. Change a column → the normalizer fails to compile until updated. That's the payoff of
Drizzle's schema-as-source-of-truth (see [`data-model.md`](./data-model.md)).

## Branded IDs

To stop accidental mixing of the different string ids floating around (internal event id, `wamid`,
phone number id, sender msisdn), use lightweight branded types in `whatsapp/types.ts`:

```ts
type Brand<T, B> = T & { readonly __brand: B }
export type EventId = Brand<string, 'EventId'>
export type Wamid   = Brand<string, 'Wamid'>
export type PhoneNumberId = Brand<string, 'PhoneNumberId'>
export type Msisdn  = Brand<string, 'Msisdn'>
```

Ports and the domain speak in branded types so you can't pass a `Msisdn` where a `Wamid` is
expected. Branding happens once, at the parse/normalize boundary.

## Typed, validated environment

Env is validated **once at startup** with Zod; the rest of the code imports a typed `env` object
and never touches `process.env` directly:

```ts
// config/env.ts  (spec sketch)
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),

  // Meta / WhatsApp
  WHATSAPP_APP_SECRET: z.string().min(1),     // HMAC key for X-Hub-Signature-256
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),   // GET handshake token
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WABA_ID: z.string().optional(),

  // Pub/Sub
  PUBSUB_TOPIC: z.string().min(1),
  PUBSUB_PUSH_AUDIENCE: z.string().optional(), // OIDC audience the worker verifies

  // DB (consumed by @severino/db pool-config)
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(['true', 'false']).optional(),

  // process role: which entrypoint this container runs
  SERVICE_ROLE: z.enum(['ingest', 'worker']).default('ingest'),
})

export const env = EnvSchema.parse(process.env)
export type Env = z.infer<typeof EnvSchema>
```

A missing secret fails the process **at boot**, not at the first webhook — so a misconfigured
deploy never silently accepts (and drops) traffic.

## tsconfig posture

Mirror [`packages/db/tsconfig.json`](../../packages/db/tsconfig.json): `strict: true`,
`module`/`moduleResolution` `NodeNext`, `target` ES2022, `isolatedModules`. Additionally treat
**`noUncheckedIndexedAccess`** as on, since we index into Meta arrays a lot and want
`messages[0]` typed as possibly `undefined`.

## No-`any` policy

- No `any` in `whatsapp/`, `ports/`, or `adapters/`. Where Meta data is genuinely open-ended
  (type-specific message bodies), the type is `unknown` and lives in a `jsonb` column — explicit,
  not `any`.
- ESLint config matches `severino-service` (`eslint-config-next` patterns where applicable, or a
  minimal `@typescript-eslint` setup for a non-Next service) with `@typescript-eslint/no-explicit-any`
  enabled.
