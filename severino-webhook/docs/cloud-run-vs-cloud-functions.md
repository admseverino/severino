# Compute Choice: Cloud Run vs Cloud Functions

The user asked specifically for the pros and cons of running this webhook as a **Google Cloud
Function** versus on **Google Cloud Run**, given that it will receive **many concurrent
messages**. Here is the full comparison and the recommendation.

> Important context: **Cloud Functions (2nd gen) runs *on* Cloud Run** under the hood. So this is
> less "two different runtimes" and more "how much of the container and scaling knobs do you want
> to control." That framing drives most of the trade-offs below.

## Quick recommendation

**Use Cloud Run for both the ingest service and the worker service.** For a bursty,
high-concurrency, latency-sensitive webhook, Cloud Run's **per-instance request concurrency** and
**`min-instances`** are decisive: they let a handful of instances soak a spike cheaply and avoid
cold-start tax on the first hit — the two things that matter most here. It also matches the rest
of Severino, which already deploys to Cloud Run via Cloud Build (see
[`README.md`](../../README.md) and [`docs/architecture-decisions.md`](../../docs/architecture-decisions.md)).

## Cloud Run — pros

- **Per-instance concurrency (the big one).** One instance can serve **many simultaneous
  requests** (configurable, up to 1000). Our ingest handler is I/O-bound (one insert, one
  publish), so a single instance handles dozens of concurrent deliveries. That means **fewer
  instances, fewer DB connections, lower cost** under a burst. This is the single most important
  factor for "a lot of concomitant messages."
- **`min-instances` to kill cold starts.** Keep ≥1 warm instance so the *first* message in a
  burst isn't delayed by a cold start — critical because Meta retries slow responses.
- **Full container control.** Any base image, any Node version, native deps, our own HTTP server,
  and — crucially — **raw-body access** for the `X-Hub-Signature-256` HMAC check without fighting a
  framework's auto-parsing.
- **Consistent with the monorepo.** Same Dockerfile + Cloud Build + Cloud SQL connector pattern
  already used by `severino-service`. One deployment story to maintain.
- **Tunable scaling & resources.** CPU, memory, concurrency, min/max instances, CPU-always-on —
  all independently configurable for the ingest tier vs the worker tier.
- **Cloud SQL connector built in** (`--add-cloudsql-instances`), same as the main app.
- **Works perfectly as a Pub/Sub push target** for the worker, with OIDC auth.

## Cloud Run — cons

- **Slightly more setup.** You own a `Dockerfile` and an HTTP server, vs. just exporting a
  function. (Mitigated: we already have this exact pattern in the repo.)
- **You manage concurrency correctly.** High concurrency means your handler must be genuinely
  non-blocking and your DB pool sized per instance; a CPU-bound bug hurts more than on a
  1-request-per-instance model.
- **Min-instances cost.** Keeping a warm instance is a small always-on cost (worth it here).

## Cloud Functions (2nd gen) — pros

- **Least boilerplate.** Write a handler, deploy; Google builds the container. Fast to stand up.
- **Native event triggers.** First-class triggers for Pub/Sub, GCS, Firestore, Eventarc — the
  **worker** could be a Pub/Sub-triggered function with zero HTTP/OIDC plumbing.
- **Same underlying scaling as Cloud Run** (it *is* Cloud Run), including concurrency support in
  2nd gen and `min-instances`.
- **Good fit for low/medium volume** or a quick MVP where you don't want to own a Dockerfile.

## Cloud Functions — cons

- **Less control at the HTTP boundary.** The managed framework's request handling can make
  **raw-body capture for HMAC** more awkward (you must ensure the exact bytes are available before
  any JSON middleware runs). Doable, but it's exactly the thing we don't want to fight on a
  signature-critical endpoint.
- **Concurrency is opt-in and historically defaulted to 1.** 1st-gen functions are **one request
  per instance**, which under a burst means **one instance per concurrent message** → instance
  explosion → connection-pool explosion against Cloud SQL. 2nd-gen *supports* concurrency, but
  you're now configuring the same knobs as Cloud Run anyway — so the "simpler" advantage shrinks.
- **Build/runtime opinionatedness.** Less freedom over base image, build steps, and process
  model than a plain container.
- **Divergent deploy story.** Adds a second deployment paradigm (function build/deploy) alongside
  the repo's existing Cloud Run + Cloud Build pipeline.

## How they map onto *our* two tiers

| Tier | What it needs | Cloud Run | Cloud Functions |
|---|---|---|---|
| **Ingest** (`POST /webhook`) | raw-body HMAC, sub-50ms `200`, high concurrency, no cold start | ✅ ideal: concurrency + min-instances + raw body | ⚠️ workable on 2nd-gen but you reconfigure the same knobs and fight raw-body |
| **Worker** (Pub/Sub consumer) | reliable Pub/Sub consumption, retries, DLQ, DB writes | ✅ Pub/Sub **push** → HTTP, OIDC-verified | ✅ Pub/Sub **trigger** is genuinely simpler here |

The only place Cloud Functions is clearly *nicer* is the worker's Pub/Sub trigger ergonomics. But
splitting the two tiers across two compute products doubles the operational surface for a small
ergonomic win. We keep both on Cloud Run for uniformity; if the worker's trigger plumbing ever
feels heavy, a 2nd-gen Pub/Sub-triggered function is a low-risk swap because the business logic is
behind ports (see [`module-structure.md`](./module-structure.md)) and doesn't know its transport.

## Decision

| | Choice |
|---|---|
| **Ingest service** | **Cloud Run** — concurrency + min-instances + raw-body control are exactly the burst-webhook requirements. |
| **Worker service** | **Cloud Run** (Pub/Sub push). Cloud Functions 2nd-gen is an acceptable alternative for this tier specifically. |
| **Tie-breaker** | Matches the existing monorepo deploy pattern; one Dockerfile/Cloud Build story to maintain. |

See [`deployment.md`](./deployment.md) for the concrete `gcloud run deploy` flags that implement
this, and [`concurrency-and-scaling.md`](./concurrency-and-scaling.md) for the sizing math behind
the concurrency and instance limits.
