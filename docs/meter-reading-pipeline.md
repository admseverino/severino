# Meter Reading Pipeline — QR Detection + AI Vision

The single trickiest feature in Severino: turning "operator points phone at a meter" into a stored, validated, audit-ready reading. This document is the reference for §4 of the workflow.

---

## TL;DR

Two distinct AI/CV concerns, kept separate:

1. **QR identification** — *which meter* is this? Solved client-side with [`jsQR`](https://github.com/cozmo/jsQR) reading the camera stream. Single library, platform-agnostic, no native API path. Cheap, instant, deterministic, offline-capable.
2. **Value extraction** — *what does the meter read?* Solved server-side by calling **OpenRouter** with **Gemini 2.5 Flash** as the default vision model (Claude Sonnet held in reserve for an escalation pass once we have real-world confidence data). The operator confirms or corrects the AI's answer before save.

We deliberately do **not** use traditional OCR for value extraction. Water-meter dials are a worst-case for OCR (rotating analog dials, reflective glass, low-contrast digits, multi-display layouts). Vision LLMs handle these cases far better and the per-call cost is acceptable for our volumes.

---

## Pipeline Overview (operator's perspective)

```text
1.  Open /reading (or scan QR from anywhere)
        │
2.  Camera opens → QR detected client-side
        │  (decoded value = meter_id or signed URL)
        ▼
3.  Server validates: meter exists, belongs to operator's condo,
    period is reading_open, operator has the right role.
        │
        ▼
4.  Reading screen shows the meter context (unit, group, last value).
        │
5.  Operator captures a photo with the camera
    OR picks one from the device gallery (no-signal fallback).
        │
6.  Photo is uploaded to GCS via signed URL.
    EXIF is parsed locally and sent alongside the GCS path.
        │
        ▼
7.  Server kicks off the AI call to OpenRouter with the photo.
    Returns { value, confidence, raw, model }.
        │
        ▼
8.  Reading screen shows the AI value pre-filled in the input.
        │
9.  Operator confirms or corrects.
        │
        ▼
10. Reading row persisted with both ai_value and (operator-confirmed) value.
    Audit row written. Anomaly flags evaluated (incl. confidence floor).
```

When offline, steps 5–6 happen against IndexedDB instead of GCS, and steps 7–10 are deferred until the device is back online.

---

## Part 1 — QR Identification

### What the QR encodes

A URL of the form:

```text
https://severi.no/r/<meter_id>
```

Where `<meter_id>` is the meter's UUID. Encoding a URL (not just an opaque ID) means **any phone QR scanner** opens the right page; we don't need our own scanner app for the QR step. When the URL is opened in Severino, it lands on the reading flow.

We may add a signed token query string later to harden against printed-QR theft, but for phase 1 a UUID is fine — the server already enforces that the meter belongs to the operator's condo and the period is open.

### Client-side detection

For the *in-app* scanner (operator opens `/reading` and points the camera at a QR without leaving the app):

- **One library, every platform: [`jsQR`](https://github.com/cozmo/jsQR).** ~40 KB gzipped, QR-only, identical behavior on iOS Safari, Android Chrome, desktop Firefox, Edge, etc. We control the QR format (we always print our own), so multi-format scanners like `@zxing/browser` would be dead weight. See [`architecture-decisions.md` §4.6](./architecture-decisions.md#46-qr-detection-library-jsqr).
- The browser-native `BarcodeDetector` API is **not** used — Safari doesn't implement it, and the cross-browser quirks in implementations that do exist would make tests brittle. Uniform JS path beats native-with-fallback for our case.

The scanner pulls frames from the `MediaStreamTrack` into an offscreen `<canvas>` and feeds the `ImageData` into `jsQR`. On a successful decode, the page navigates to `/r/<meter_id>`.

### Server-side validation (the part that matters)

Whatever opens the URL, the server runs the same checks before showing the capture screen:

| Check | Behavior on failure |
|---|---|
| Meter exists and is `status = 'active'` | 404 |
| Meter belongs to a condo where the user has `operator` (or higher) role | 403 |
| The meter's condo has a period in `reading_open` | Friendly "no open period" page |
| No reading already exists for this `(meter_id, period_id)` | Show existing reading + offer "replace" (admin only) |

This is the reason QR detection alone isn't enough — the server is the one source of truth for "can this person read this meter right now?".

---

## Part 2 — Value Extraction via OpenRouter

### Why OpenRouter (instead of going direct)

- **Provider-agnostic.** One API surface, dozens of vision models. We can A/B Claude vs. GPT-4o vs. Gemini without rewriting code or signing more contracts.
- **Cost flexibility.** Cheap models (Gemini Flash, Llama 3.2 Vision, Qwen2-VL) for the first pass; escalate to a stronger model only when confidence is low.
- **No-retention options.** OpenRouter exposes provider-level data-handling flags; we can route to providers with no-train / no-retention guarantees, which matters for LGPD on tenant photos.
- **Single bill.** One vendor invoice instead of three or four.

### The adapter

`modules/ai/MeterReader.ts` exports the interface:

```text
interface MeterReader {
  read(input: { imageGcsPath: string; meterContext?: MeterContext }):
    Promise<{
      value: number | null;
      confidence: number;          // 0..1
      raw: string;                 // full model response (kept for audit)
      model: string;               // e.g. "google/gemini-2.5-flash"
      latencyMs: number;
    }>;
}
```

Implementations:

- `MockMeterReader` — returns a deterministic value based on the photo's filename hash. Used in dev, tests, and as the offline fallback.
- `OpenRouterMeterReader` — calls OpenRouter's chat-completion endpoint with the photo as a `image_url` content part.

The route handler in `app/api/readings/extract/route.ts` selects the implementation from env (`AI_METER_READER=openrouter|mock`).

### Prompt shape (sketch — refined in M4)

```text
SYSTEM:
  You are reading a residential water meter. Output STRICT JSON only.
  Schema:
    { "value": number, "confidence": number, "notes": string }
  - "value" is the cubic-metre reading shown on the meter, including
    the post-decimal digits if any are visible (e.g. 1234.567).
  - "confidence" is your self-assessed certainty 0.0–1.0.
  - If the meter is unreadable (blur, glare, occluded), return value = null
    and confidence = 0 with a brief reason in "notes".

USER (vision):
  [image of the meter]
  Context: meter_id=<uuid>, last_known_reading=<n>, unit=<string>.
  Read the value shown on the main odometer, ignoring smaller dials.
```

Notes:

- We pass `last_known_reading` so the model can sanity-check itself ("the new value should be ≥ last value, usually within a sensible delta").
- We pass the meter context so the model can disambiguate when the photo shows multiple meters.
- Strict JSON output is enforced via `response_format: { type: "json_object" }` on models that support it; for models that don't, we parse defensively and fall back to `confidence: 0` on parse failure.

### Image handling

- **Resize on the client to ~1024 px** on the long edge before upload (`browser-image-compression`). Keeps GCS bills and AI input tokens down. Original full-resolution photo is also kept in GCS for audit.
- **GCS path is the source of truth** passed to the AI — we generate a short-lived signed URL and put it in the `image_url` content part. Means the AI provider never sees our bucket name or our photo storage layout.

### Confidence-driven flagging

The `condo_config.ocr_confidence_floor` column already exists in the schema (default 0.7). We keep the column name to avoid a churny rename — it now means "AI confidence floor". Any reading whose `ai_confidence < ocr_confidence_floor` is flagged for review.

We also flag when `ai_value` and the operator-confirmed `value` diverge by more than X% (a soft signal that the operator overrode the AI a lot — useful for catching either bad photos or a model regression).

### Data model additions (on top of `readings`)

The `readings` table gains:

| Column | Type | Notes |
|---|---|---|
| `ai_value` | `numeric` nullable | What the AI returned |
| `ai_confidence` | `numeric(3,2)` nullable | 0.00 – 1.00 |
| `ai_model` | `text` nullable | e.g. `google/gemini-2.5-flash` (default first-pass) or `anthropic/claude-sonnet-4` (escalation, when added in M10) |
| `ai_raw_response` | `jsonb` nullable | Full structured response, for audit |
| `ai_latency_ms` | `int` nullable | For cost/perf monitoring |
| `value` | `numeric` not null | **Operator-confirmed value, the source of truth.** |

The audit log records any operator override of the AI value (`before = ai_value`, `after = value`).

---

## Failure Modes and How They're Handled

| Failure | Handling |
|---|---|
| Operator's device has no network at capture time | Reading queued in IndexedDB (photo blob + EXIF). On reconnect: GCS upload → AI extract → operator gets a notification to confirm. |
| OpenRouter is down / times out | Reading is saved with `ai_value = null`, `ai_status = 'failed'`. Operator types the value manually; flagged for review. |
| Model returns unparseable text | Logged; treated as `confidence = 0`. Same as above. |
| Photo is blurry / glared | Model returns low confidence, anomaly flag fires. Editor reviews in §5. |
| Wrong meter scanned (QR mismatch with photo content) | Detected at review time when the AI value diverges wildly from history. The operator's `meter_id` from the QR is trusted; the photo is suspect. |
| OpenRouter API key compromised | Rotate via env var; no client-side keys. The key never ships to the browser; the browser uploads to GCS only. |

---

## Privacy and LGPD

- Photos are routed via OpenRouter to a provider. Default to providers that **don't retain or train on inputs** — OpenRouter exposes per-call data-handling flags.
- Document this clearly in the privacy policy and tenant consent surface.
- Photos may contain incidental PII (a hand, a doorway). Treat them with the same retention rules as any other reading photo (see `Data Retention & Privacy` in the workflow).
- Tenant LGPD deletion → photos are anonymized by removing EXIF GPS and any metadata that points back to a person; consumption rows survive (referenced by anonymized `unit_id` only), per the workflow's existing rule.

---

## Cost Envelope (rough)

Order-of-magnitude estimate to validate the approach is viable, using **Gemini 2.5 Flash** (the default first-pass model — see [Decisions](#decisions) below).

- Vision call cost (Gemini 2.5 Flash, ~1024 px image, ~150 input tokens, ~50 output tokens) ≈ **$0.001 / call** at current OpenRouter rates.
- 1 condo of 100 units × 1 reading/month = **$0.10 / condo / month**.
- Even at 10,000 condos this is **$1,000 / month** for value extraction — comfortably within any SaaS pricing tier.

If escalation to Claude Sonnet is added later (only triggered on low-confidence first-pass results, expected ~10–20% of reads), the blended cost roughly doubles — still under $0.25 / condo / month. Well within budget.

---

## Phase-1 Implementation Notes (for M4)

- Ship M4 with `MockMeterReader` enabled by default in dev. Real OpenRouter implementation gated behind env var so it doesn't burn money during local dev.
- One Playwright e2e: capture flow with the mock — asserts the AI value pre-fills, the operator can override, and both values land in the row.
- Add structured logs around every OpenRouter call: `meter_id`, `period_id`, `model`, `latency_ms`, `confidence`, `parse_status`. These are the inputs to the AI-quality dashboard we'll want by M10.
- Anomaly evaluation runs on **every** reading save (not only at period close), so the editor's queue stays current.

---

## Decisions

These were the M4-kickoff open questions; they are now locked. Validation against real meter photos still happens during M4 implementation, but the defaults are set.

### A. First-pass model — Gemini 2.5 Flash

**Decision:** Default to `google/gemini-2.5-flash` (or whatever the current cheap-fast Gemini vision tier is on OpenRouter at the time of pinning) for the first-pass meter read.

**Why:**

- **Best price/performance ratio** for vision in the current generation — ~10× cheaper per call than Claude Sonnet at meaningfully similar accuracy on standard water-meter reads.
- **Latency matters here** — the operator is staring at the screen waiting for the suggestion to populate. Flash-tier models return in ~1–2 s; Sonnet/4o sit at 3–5 s.
- Brazil → São Paulo region for inference is closer on Google than on Anthropic (lower tail latency).
- The cheap cost makes it cost-viable to call the AI on **every** capture, including offline-queued ones, without rationing.

The `OPENROUTER_METER_MODEL` env var pins the exact slug per environment so we can upgrade in dev before promoting to prod.

### B. Escalation strategy — single model first, add escalation in M10 if data warrants

**Decision:** Ship M4 with a **single-model** path. Add a confidence-driven escalation rule (retry with Claude Sonnet when `confidence < 0.5` or `value === null`) only if M4–M9 production data shows it's needed.

**Why:**

- Premature optimization. We don't know what the real-world confidence distribution looks like until we have a few hundred readings.
- The simplest escalation rule is a ~10-line addition once we have data — adapter shape is already designed for it.
- `ai_raw_response` is persisted from every first-pass call, so we can **retroactively replay** historical low-confidence readings against Sonnet and validate the threshold *before* shipping the escalation in production.
- Saves M4 complexity for the parts that are genuinely complex (offline queue, EXIF pipeline).

### C. Multi-display meters — solve in the prompt, not in code

**Decision:** Handle multi-display meters (cumulative + interval, or analog + digital) entirely through prompt engineering. No segmentation, no per-region OCR, no second model.

**Why:**

- Vision LLMs respond strongly to explicit disambiguation in the system prompt (few-shot example showing "the small dial that resets is the *interval* — ignore it; read the *cumulative* main odometer").
- A model-side fix is one PR; a code-side fix is its own multi-week project.
- Validate during M4 with **20–30 real photos** from the planned first condo before going to production.
- If the prompt approach fails on a specific meter model, the fallback is "ask the operator to take a tighter shot of the cumulative dial" — much cheaper than building meter-aware CV.

### D. Image preprocessing (cropping to meter face) — not in phase 1

**Decision:** Send the photo (downscaled to 1024 px on the long edge — see [Image handling](#image-handling)) directly to OpenRouter without a crop step. No detection model, no second AI call to find the meter face.

**Why:**

- Adds a second AI call (or a CV detection model) on the hot path. Doubles latency and cost.
- Modern vision models tolerate uncropped, in-context photos well — the meter is usually centered already because the operator is *aiming* at it.
- Revisit only if M5's review queue shows a pattern of "AI couldn't find the meter face" failures. Even then, simpler interventions (in-app camera framing guides, a "tap the meter face" interaction in the capture UI) come first.

---

## Open Items for M4 Kickoff

Genuinely deferred — these need real-photo data to answer well:

1. **Exact prompt wording.** Iterate against 20–30 real meter photos from the first onboarded condo. Check into `modules/ai/meter-reader-prompts/` and version with the rest of the code.
2. **Confidence floor calibration.** Default `condo_config.ocr_confidence_floor = 0.7` is a guess; tune after observing the actual first-week distribution.
3. **OpenRouter routing flags.** Confirm the no-retention / no-train flags work as advertised for whichever underlying provider Gemini 2.5 Flash routes through; document in the privacy policy.
