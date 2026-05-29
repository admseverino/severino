import path from 'node:path'

import { loadEnvConfig } from '@next/env'
import { defineConfig, devices } from '@playwright/test'

// Load `severino-service/.env*` the same way Next does (DATABASE_URL, NEXTAUTH_SECRET, …).
loadEnvConfig(path.resolve(process.cwd()))

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4000'
// NextAuth rejects mismatched origin; keep in sync with the Playwright base URL / dev server port.
process.env.NEXTAUTH_URL = baseURL
// Onboarding tests assert exact row counts → keep the deterministic mock extractor unless the
// dev explicitly opts into the real LLM with `PLAYWRIGHT_USE_REAL_LLM=true`.
if (!process.env.ONBOARDING_LLM_PROVIDER && process.env.PLAYWRIGHT_USE_REAL_LLM !== 'true') {
  process.env.ONBOARDING_LLM_PROVIDER = 'mock'
}
const startWebServer = process.env.PLAYWRIGHT_WEB_SERVER !== 'false'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: startWebServer
    ? {
        command: 'pnpm exec next dev -H 127.0.0.1 -p 4000',
        cwd: path.resolve(process.cwd()),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
})
