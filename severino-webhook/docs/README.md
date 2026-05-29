# Severino WhatsApp Webhook (`severino-webhook`)

A standalone, type-safe service that receives **WhatsApp Cloud API** webhook events from
Meta, validates them, and persists inbound messages for the rest of the Severino platform
to consume. It is built to absorb **bursts of many concurrent messages** without dropping or
double-processing any of them.

This folder contains **only documentation**. No code exists yet — these docs are the design
of record that the implementation must follow. They are intentionally decision-driven (the
same `Why / Why not / Conventions` style used in [`docs/architecture-decisions.md`](../../docs/architecture-decisions.md)).

## Design goals

1. **Receive WhatsApp messages reliably.** Implement Meta's webhook contract exactly:
   `GET` verification handshake, `POST` event delivery, `X-Hub-Signature-256` validation,
   and a fast `200 OK` so Meta does not retry. See
   [`whatsapp-integration.md`](./whatsapp-integration.md).
2. **Type-safe end to end.** Every external payload is parsed with Zod at the boundary;
   nothing untyped reaches the database. The DB layer is Drizzle, sharing the monorepo's
   typed schema. See [`type-safety.md`](./type-safety.md).
3. **Drizzle for persistence.** The only part of this service that is *not* self-contained
   is the database layer: tables live in the shared `@severino/db` package
   ([`packages/db`](../../packages/db)) like every other bounded context. See
   [`data-model.md`](./data-model.md).
4. **Modular and isolated.** Apart from `@severino/db`, everything lives inside
   `severino-webhook/`. No imports from `severino-service`, no shared runtime. See
   [`module-structure.md`](./module-structure.md).
5. **Built for concurrency.** A burst of hundreds of simultaneous messages must be
   acknowledged in milliseconds and processed exactly-once. See
   [`concurrency-and-scaling.md`](./concurrency-and-scaling.md).

## Document map

| Document | What it covers |
|---|---|
| [`architecture.md`](./architecture.md) | The fast-ack / async-process split, request lifecycle, sequence diagrams |
| [`whatsapp-integration.md`](./whatsapp-integration.md) | Meta Cloud API webhook contract: verification, signature, payload shape, dedup, retries |
| [`data-model.md`](./data-model.md) | Drizzle schema (in `@severino/db`): raw events, inbound messages, statuses, dedup keys |
| [`type-safety.md`](./type-safety.md) | Zod-at-the-boundary, typed env, branded IDs, no `any` policy |
| [`concurrency-and-scaling.md`](./concurrency-and-scaling.md) | Handling burst traffic, idempotency, ordering, backpressure |
| [`cloud-run-vs-cloud-functions.md`](./cloud-run-vs-cloud-functions.md) | Pros/cons of Cloud Run vs Cloud Functions for this workload, with a recommendation |
| [`module-structure.md`](./module-structure.md) | Folder layout, module boundaries, dependency rules, the ports/adapters seam |
| [`deployment.md`](./deployment.md) | Cloud Build pipeline, secrets, env vars, migrations, IAM |
| [`local-development.md`](./local-development.md) | Running locally, tunneling to Meta, replaying payloads, tests |

## TL;DR of the decisions

- **Compute:** **Cloud Run** (not Cloud Functions). It gives per-instance concurrency,
  configurable min instances to kill cold starts on bursty traffic, and a plain container we
  fully control. Full reasoning in [`cloud-run-vs-cloud-functions.md`](./cloud-run-vs-cloud-functions.md).
- **Pattern:** **Fast-ack + async fan-out.** The HTTP handler does only: verify signature →
  persist the raw envelope → enqueue → return `200`. All parsing/business logic happens
  off the request path on a worker (Pub/Sub push subscription, also on Cloud Run).
- **Persistence:** **Drizzle** tables in `@severino/db`. Two tables: an append-only
  `whatsapp_events` (the raw, signed envelope) and a normalized `whatsapp_messages`
  (the parsed, deduplicated messages).
- **Idempotency:** WhatsApp message IDs (`wamid.*`) are the natural dedup key; a unique
  index makes redelivery a no-op.
