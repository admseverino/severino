# Concurrency & Scaling

The defining requirement: **the webhook will receive a lot of concomitant messages.** This
document is the playbook for absorbing bursts without dropping, double-counting, or reordering
ourselves into incorrect state.

## The four problems of burst ingest

1. **Throughput** — many requests land in a tiny window.
2. **Idempotency** — Meta retries deliveries; the same message can arrive 2+ times.
3. **Backpressure** — downstream (Postgres, domain consumers) is slower than the spike.
4. **Ordering** — messages from one sender should be applied in a sensible order.

The fast-ack architecture (see [`architecture.md`](./architecture.md)) is how we solve all four
without coupling them to Meta's retry timer.

## 1. Throughput — keep the hot path O(1)

The ingest handler does three things only: **verify signature → one INSERT → one publish →
`200`.** No business logic, no fan-out joins, no external HTTP. Target latency **< 50 ms p99**.

- **Per-instance concurrency.** On Cloud Run we set `--concurrency` high (e.g. **80**) because
  the handler is I/O-bound (one insert, one publish) and spends most of its time awaiting, not
  burning CPU. One instance therefore serves many simultaneous requests.
- **Autoscaling.** Cloud Run adds instances when concurrent requests exceed the target. We set a
  generous `--max-instances` and a small `--min-instances` (≥1) so the *first* burst doesn't pay
  a cold start. See [`cloud-run-vs-cloud-functions.md`](./cloud-run-vs-cloud-functions.md).
- **Batches.** A single Meta delivery may carry **up to 1000 updates**. We store the whole
  envelope as **one** `whatsapp_events` row and one Pub/Sub message — the fan-out to individual
  `whatsapp_messages` happens on the worker, off the request path.

## 2. Idempotency — `wamid` is the dedup key

WhatsApp gives every message a globally unique id (`wamid.*`). Two independent layers guarantee
exactly-once *effect*:

- **DB-level:** `whatsapp_messages.wamid` has a **unique index**. The worker upserts with
  `INSERT … ON CONFLICT (wamid) DO NOTHING`. A redelivered message hits the conflict and writes
  nothing — no duplicate row, no double downstream effect.
- **Event-level:** the worker checks/sets `whatsapp_events.processed_at`. Reprocessing the same
  event is a cheap no-op.

This is why the ingest side can safely `200` *before* the message is normalized: even if Meta
retries (because our `200` was slow), the retry deduplicates naturally.

```
deliver(wamid=A) ─┐
                  ├─▶ INSERT ... ON CONFLICT (wamid) DO NOTHING ─▶ exactly one row A
deliver(wamid=A) ─┘   (retry)
```

## 3. Backpressure — Pub/Sub is the shock absorber

The spike hits Pub/Sub, not Postgres. Pub/Sub buffers the burst and **push-delivers to the
worker at a rate the worker (and DB) can sustain**:

- A worker that returns `5xx` (or times out) **nacks**; Pub/Sub redelivers with exponential
  backoff, spreading load over time instead of hammering a struggling DB.
- We bound the **worker's** Cloud Run `--max-instances` and keep its DB pool small per instance
  (the package default is `max: 5` in prod, see
  [`packages/db/src/pool-config.ts`](../../packages/db/src/pool-config.ts)). `max_instances ×
  pool_max` must stay **comfortably under Cloud SQL's `max_connections`**. This is the single
  most important capacity sum to get right — compute it explicitly in
  [`deployment.md`](./deployment.md).
- Pub/Sub **flow control** (max outstanding messages) caps how many are in flight to the worker
  fleet at once, giving a hard ceiling on concurrent DB work regardless of spike size.

Net effect: the *ingest* tier scales with Meta's traffic (it must, to keep `200`s fast); the
*worker* tier scales with what Postgres can take. The queue decouples the two.

## 4. Ordering — good enough, on purpose

WhatsApp does not guarantee delivery order, and neither does Pub/Sub by default. We do **not**
chase strict global ordering. Instead:

- Each message carries `messages[].timestamp`; we store it as `wa_timestamp` and **order by it**
  on read, not by arrival order. Out-of-order arrival is therefore invisible to readers.
- If a future consumer needs per-sender ordering during processing, enable **Pub/Sub ordering
  keys** with the sender (`from`/`phone_number_id`) as the key. This serializes one sender while
  keeping different senders parallel. We note it as an opt-in, not a default, because ordering
  keys reduce throughput.

## Failure handling & dead-lettering

- Worker exceptions → `5xx` → Pub/Sub retry with backoff up to the subscription's retention.
- After `maxDeliveryAttempts`, the message goes to a **dead-letter topic**. The originating
  `whatsapp_events` row keeps `process_error` and `process_attempts`, so a human (or a sweep) can
  inspect and replay.
- **Reconciliation sweep:** a scheduled job (Cloud Scheduler, mirroring the pattern in
  [`docs/architecture-decisions.md` §4.4](../../docs/architecture-decisions.md)) periodically
  finds `whatsapp_events WHERE processed_at IS NULL AND received_at < now() - interval` and
  re-publishes them. This catches the rare case where the ingest insert succeeded but the publish
  was lost — guaranteeing **no envelope is ever stranded**.

## Capacity sizing (worked example)

Assume a burst of **5,000 messages in 10 seconds** (500 msg/s):

| Tier | Knob | Setting | Reasoning |
|---|---|---|---|
| Ingest | concurrency | 80 | I/O-bound; few instances cover the spike |
| Ingest | max-instances | 20 | 20 × 80 = 1,600 in-flight ≫ 500/s with <50 ms each |
| Ingest | min-instances | 1 | avoid cold start on first burst |
| Pub/Sub | flow control | ~200 outstanding | hard ceiling on concurrent worker work |
| Worker | concurrency | 10 | DB-bound; smaller is safer |
| Worker | max-instances | 10 | 10 × pool(5) = 50 connections |
| Cloud SQL | max_connections | ≥ 100 | 50 (worker) + 5 (ingest, if it ever queries) + headroom |

These are **starting points** to validate with the load test in
[`local-development.md`](./local-development.md), not magic numbers.

## Why not handle concurrency synchronously?

A synchronous handler "just write to the DB then `200`" makes Meta's retry behavior a function of
Postgres latency: slow DB → slow `200` → Meta retries → more inserts → slower DB. Under the
stated burst load that's a self-reinforcing spiral. The queue is what converts an unbounded
inbound spike into a bounded, retryable, deduplicated stream — which is the entire point of the
design.
