import { LlmOnboardingExtractor, type LlmProvider } from './llm'
import { MockOnboardingExtractor } from './mock'
import type { OnboardingExtractor } from './types'

export type { OnboardingExtractor, ExtractedStructure, ExtractedGroup, ExtractedUnit, ExtractedMeter } from './types'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'
const OPENROUTER_DEFAULT_MODEL = 'google/gemini-2.5-flash'

type ResolvedProvider = LlmProvider | 'mock'

let logged = false

function log(msg: string): void {
  if (logged) return
  logged = true
  console.info(`[onboarding] ${msg}`)
}

const DEFAULT_LLM_TIMEOUT_MS = 25_000

function readLlmTimeoutMs(): number {
  const raw = process.env.ONBOARDING_LLM_TIMEOUT_MS?.trim()
  if (!raw) return DEFAULT_LLM_TIMEOUT_MS
  const n = Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_LLM_TIMEOUT_MS
  return Math.min(600_000, Math.max(5_000, Math.floor(n)))
}

function readProvider(): ResolvedProvider {
  const raw = process.env.ONBOARDING_LLM_PROVIDER?.trim().toLowerCase()
  if (raw === 'mock' || raw === 'openai' || raw === 'openrouter') {
    return raw
  }
  // Legacy alias kept for back-compat with the earlier mock-forcing flag.
  if (process.env.SEVERINO_ONBOARDING_EXTRACTOR?.trim().toLowerCase() === 'mock') {
    return 'mock'
  }
  // Auto-detect: prefer OpenAI when both keys are present.
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai'
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter'
  return 'mock'
}

function buildOpenAI(): OnboardingExtractor | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.OPENAI_MODEL?.trim() || OPENAI_DEFAULT_MODEL
  const timeoutMs = readLlmTimeoutMs()
  log(`extractor = openai (${model}, timeoutMs=${timeoutMs})`)
  return new LlmOnboardingExtractor({
    provider: 'openai',
    endpoint: OPENAI_ENDPOINT,
    apiKey,
    model,
    timeoutMs,
    onCall: logCall,
  })
}

function buildOpenRouter(): OnboardingExtractor | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) return null
  const model = process.env.OPENROUTER_ONBOARDING_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL
  const extraHeaders: Record<string, string> = {
    'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Severino',
  }
  if (process.env.OPENROUTER_SITE_URL) {
    extraHeaders['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL
  }
  const timeoutMs = readLlmTimeoutMs()
  log(`extractor = openrouter (${model}, timeoutMs=${timeoutMs})`)
  return new LlmOnboardingExtractor({
    provider: 'openrouter',
    endpoint: OPENROUTER_ENDPOINT,
    apiKey,
    model,
    extraHeaders,
    timeoutMs,
    onCall: logCall,
  })
}

function logCall(info: { provider: LlmProvider; model: string; latencyMs: number; parsedOk: boolean }): void {
  console.info(
    `[onboarding] llm call provider=${info.provider} model=${info.model} latencyMs=${info.latencyMs} parsedOk=${info.parsedOk}`
  )
}

/**
 * Single switch point for the prompt → structure adapter.
 *
 * Env vars:
 * - `ONBOARDING_LLM_PROVIDER` = `mock` | `openai` | `openrouter` (explicit selector).
 *   When unset, auto-detects: OpenAI key first, then OpenRouter, then mock.
 * - `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`, default `gpt-4o-mini`).
 * - `OPENROUTER_API_KEY` (+ optional `OPENROUTER_ONBOARDING_MODEL`, default
 *   `google/gemini-2.5-flash`; `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME` for attribution).
 * - `ONBOARDING_LLM_TIMEOUT_MS` (optional, default 25000, clamped 5000–600000): chat request
 *   deadline; raise for slow frontier models so the client does not abort before the API responds.
 *
 * Both LLM adapters self-heal to the mock on any error so callers never need try/catch.
 */
export function getOnboardingExtractor(): OnboardingExtractor {
  const provider = readProvider()
  if (provider === 'mock') {
    log('extractor = mock (no key configured, or ONBOARDING_LLM_PROVIDER=mock)')
    return new MockOnboardingExtractor()
  }

  const built = provider === 'openai' ? buildOpenAI() : buildOpenRouter()
  if (built) return built

  log(`extractor = mock (ONBOARDING_LLM_PROVIDER=${provider} but no API key set)`)
  return new MockOnboardingExtractor()
}
