/**
 * Loads repo-root `.env` / `.env.local` without overriding existing env vars, then applies
 * `severino-service/.env` + `.env.local` for DATABASE_URL / DATABASE_SSL (same DB as Next.js).
 * Resolves superadmin credentials, then runs `severino-service` create-superadmin (tsx).
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const REPO_ROOT = path.resolve(__dirname, '..')

function loadDotenvNoOverride(filePaths) {
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf8')
    for (let line of content.split(/\r?\n/)) {
      line = line.replace(/\r$/, '').trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx === -1) continue
      const key = line.slice(0, eqIdx).trim()
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
      if (process.env[key] !== undefined) continue
      let value = line.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  }
}

function parseEnvFile(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  let content = fs.readFileSync(filePath, 'utf8')
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }
  for (let line of content.split(/\r?\n/)) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(eqIdx + 1).trim()
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

/** Match `loadProvisioningEnv`: service env wins for DB URL (same as `next dev`). */
function applySeverinoServiceDatabaseEnv(repoRoot) {
  const serviceDir = path.join(repoRoot, 'severino-service')
  const merged = {}
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

function describeDatabaseUrl(urlStr) {
  if (!urlStr || !String(urlStr).trim()) {
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

loadDotenvNoOverride([
  path.join(REPO_ROOT, '.env'),
  path.join(REPO_ROOT, '.env.local'),
])

applySeverinoServiceDatabaseEnv(REPO_ROOT)

const emailRaw =
  process.env.superadminuser ??
  process.env.SUPERADMINUSER ??
  process.env.SUPERADMIN_USER
const password =
  process.env.superadminpass ??
  process.env.SUPERADMINPASS ??
  process.env.SUPERADMIN_PASS

const email = emailRaw?.trim().toLowerCase() ?? ''
if (!email || !password) {
  console.error(
    'error: set superadminuser/superadminpass or SUPERADMIN_USER/SUPERADMIN_PASS (e.g. in repo-root .env).'
  )
  process.exit(1)
}

process.env.superadminuser = email
process.env.superadminpass = password

console.log('▶ database:', describeDatabaseUrl(process.env.DATABASE_URL))

const result = spawnSync(
  'pnpm',
  ['--filter', 'severino-service', 'run', 'create-superadmin'],
  {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: true,
  }
)

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
process.exit(result.status === null ? 1 : result.status)
