# Module Structure

The requirement: **modular, and everything lives only inside `severino-webhook/` — except the
Drizzle DB layer, which lives in the shared `@severino/db` package.** This document defines the
folder layout, the module boundaries, and the dependency rules that keep the service isolated and
testable.

## Workspace placement

`severino-webhook` is a new workspace package, registered alongside the others. Today
[`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) lists `packages/*` and `severino-service`; add
the new service:

```yaml
packages:
  - "packages/*"
  - "severino-service"
  - "severino-webhook"
```

Its only internal dependency is `@severino/db` (`workspace:*`). It does **not** depend on
`severino-service`, and `severino-service` does **not** depend on it. The two communicate only
through the shared database tables and (optionally) domain events.

## Folder layout

```
severino-webhook/
├── docs/                       # these documents
├── src/
│   ├── ingest/                 # ENTRYPOINT 1 — the HTTP webhook (fast-ack)
│   │   ├── server.ts           #   HTTP bootstrap (the only place that binds a port)
│   │   ├── routes.ts           #   GET /webhook (verify), POST /webhook (events)
│   │   └── verify-signature.ts #   X-Hub-Signature-256 HMAC, raw-body based
│   │
│   ├── worker/                 # ENTRYPOINT 2 — the async processor (Pub/Sub push target)
│   │   ├── server.ts           #   HTTP bootstrap for the push subscription
│   │   └── handler.ts          #   load event -> normalize -> persist -> ack/nack
│   │
│   ├── whatsapp/               # DOMAIN — pure, transport-agnostic
│   │   ├── schema.ts           #   Zod schemas for Meta payloads (wire types)
│   │   ├── normalize.ts        #   WhatsAppChangeBatch (wire) -> NewWhatsAppMessageRow (DB)
│   │   └── types.ts            #   inferred wire types + branded ids
│   │
│   ├── ports/                  # INTERFACES — the seams that keep domain pure
│   │   ├── message-store.ts    #   interface MessageStore { upsertMessages, markEvent... }
│   │   ├── event-store.ts      #   interface EventStore   { insertRaw, loadById... }
│   │   ├── event-publisher.ts  #   interface EventPublisher { publish(eventId) }
│   │   └── inbound-message-handler.ts  # app-specific inbound side effects
│   │
│   ├── handlers/               # APP HANDLERS — business meaning keyed by phone_number_id
│   │   ├── severino-inbound-handler.ts
│   │   └── handler-router.ts
│   │
│   ├── adapters/               # IMPLEMENTATIONS — the only code that touches infra
│   │   ├── drizzle-message-store.ts   # implements MessageStore via @severino/db
│   │   ├── drizzle-event-store.ts     # implements EventStore via @severino/db
│   │   └── pubsub-publisher.ts        # implements EventPublisher via @google-cloud/pubsub
│   │
│   ├── config/
│   │   └── env.ts              #   Zod-validated environment (see type-safety.md)
│   │
│   └── observability/
│       └── log.ts             #   structured logging helper
│
├── tests/                      # unit + integration tests (mirrors src/)
├── Dockerfile                  # multi-stage, same shape as severino-service
├── cloudbuild.yaml             # build + deploy both services (see deployment.md)
├── package.json                # name: "severino-webhook", deps: @severino/db (workspace:*)
└── tsconfig.json               # NodeNext ESM, strict — mirrors packages/db/tsconfig.json
```

## Dependency rule (the important part)

Dependencies point **inward**, ports/adapters style:

```
ingest ─┐
        ├─▶ whatsapp (domain)  ─▶  ports (interfaces)
worker ─┘                              ▲
                                       │ implements
                              adapters ┘ ─▶ @severino/db, Pub/Sub
```

Concretely:

- **`whatsapp/` (domain) imports nothing from infra.** No `pg`, no `@severino/db`, no
  `@google-cloud/pubsub`, no `express`. It depends only on `ports/` interfaces and Zod. This is
  what makes it unit-testable with plain in-memory fakes and is the heart of "modular."
- **`ports/` are pure TypeScript interfaces.** They reference the **DB row types inferred from
  `@severino/db`** as data shapes, but not the client. (Importing a *type* from the schema is
  fine; importing the *pool* is not.)
- **`adapters/` are the only files that import infra** (`@severino/db`'s `db()` client,
  `@google-cloud/pubsub`). They implement the ports.
- **`ingest/` and `worker/` are entrypoints** — they wire concrete adapters into the domain and
  bind an HTTP port. They are thin.

Why this matters: the choice between Cloud Run and Cloud Functions, or between Pub/Sub and Cloud
Tasks, becomes a swap of one adapter + one entrypoint. The domain never changes. (See
[`cloud-run-vs-cloud-functions.md`](./cloud-run-vs-cloud-functions.md).)

## Two entrypoints, one image

Both `ingest` and `worker` ship in the **same container image**; the Cloud Run service decides
which to run via an env var or command, e.g. `node dist/ingest/server.js` vs
`node dist/worker/server.js`. This keeps one build, one set of shared modules, and avoids
drift between the two. See [`deployment.md`](./deployment.md).

## What stays out of `severino-webhook`

- **Database tables and migrations** → `@severino/db` (`packages/db/src/schema/whatsapp.ts` and
  generated SQL). This is the one explicit exception to "everything lives in `severino-webhook`,"
  and it follows the monorepo's single-DB-boundary decision
  ([`docs/architecture-decisions.md` §4.1](../../docs/architecture-decisions.md)).
- **Nothing from `severino-service`.** No shared `lib/`, no shared components. If something truly
  needs sharing later, it gets promoted into its own `packages/*` package — not imported across
  service boundaries. Outbound WhatsApp send lives in `@severino/phone`; app-specific messaging
  intents (e.g. meter-reading confirm prompts) live in `severino-service/modules/messaging`.

## Conventions (mirroring the repo)

- **ESM + NodeNext**, `.js` import specifiers in source (as in
  [`packages/db/src`](../../packages/db/src)), `"type": "module"`, `strict: true`.
- One module per bounded concern; a barrel `index.ts` only where it aids consumers.
- Tests live under `tests/` mirroring `src/` (the repo uses `tests/` for e2e in
  `severino-service`). Domain logic is unit-tested against in-memory port fakes; adapters get a
  thin integration test against a real Postgres (see [`local-development.md`](./local-development.md)).
- When you change a port's contract, update its fake, both adapters, and the consuming entrypoint
  in the same PR.
