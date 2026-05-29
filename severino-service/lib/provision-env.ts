import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Walk up from `startDir` until `pnpm-workspace.yaml` exists (monorepo root). */
export function getMonorepoRootDir(startDir: string): string {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 20; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }
  throw new Error(
    'Could not find monorepo root (pnpm-workspace.yaml). Run provisioning from the Severino repo.'
  )
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {}
  }
  let content = readFileSync(filePath, 'utf8')
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  const out: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = trimmed.slice(eqIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/** Set `process.env[key]` only when the key is not already defined. */
function applyEnvNoOverride(vars: Record<string, string>): void {
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/**
 * Load repo-root `.env` / `.env.local` (no override), then apply `severino-service` `.env`
 * / `.env.local` for `DATABASE_URL` and `DATABASE_SSL` so provisioning hits the **same DB as
 * `next dev`** (Next loads env from the app package directory).
 */
export function loadProvisioningEnv(monorepoRoot: string): void {
  for (const name of ['.env', '.env.local']) {
    applyEnvNoOverride(parseEnvFile(path.join(monorepoRoot, name)))
  }

  const serviceDir = path.join(monorepoRoot, 'severino-service')
  const merged: Record<string, string> = {}
  for (const name of ['.env', '.env.local']) {
    Object.assign(merged, parseEnvFile(path.join(serviceDir, name)))
  }

  if (merged.DATABASE_URL !== undefined && merged.DATABASE_URL !== '') {
    process.env.DATABASE_URL = merged.DATABASE_URL
  }
  if (merged.DATABASE_SSL !== undefined) {
    process.env.DATABASE_SSL = merged.DATABASE_SSL
  }
}

/** Safe log line for which Postgres database is targeted (no password). */
export function describeDatabaseUrl(urlStr: string | undefined): string {
  if (!urlStr?.trim()) {
    return '(DATABASE_URL not set)'
  }
  try {
    const u = new URL(urlStr)
    const db = decodeURIComponent(u.pathname.replace(/^\//, '')) || '(no database name)'
    const port = u.port || (u.protocol === 'postgresql:' || u.protocol === 'postgres:' ? '5432' : '')
    return `${u.hostname}${port ? `:${port}` : ''}/${db}`
  } catch {
    return '(could not parse DATABASE_URL)'
  }
}
