/**
 * Apply Drizzle migrations (no Next.js build-time pool guard).
 * Loads **only** the repo-root `.env` for this process (see `loadMigrateEnvFromRepoRoot`).
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client, Pool } from 'pg'
import { getPoolConfig } from './pool-config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Walk up from `startDir` until `pnpm-workspace.yaml` exists (monorepo root). */
function getMonorepoRootDir(startDir: string): string {
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
    'Could not find monorepo root (pnpm-workspace.yaml). Run `pnpm run db:migrate` from the HidroSync repo.'
  )
}

function parseEnvFile(filePath: string): Record<string, string> {
  let content = readFileSync(filePath, 'utf8')
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1)
  }

  const out: Record<string, string> = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
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

/**
 * Only `migrate:db` uses the repo-root `.env` for DB connection vars.
 * Overrides `DATABASE_URL` / `DATABASE_SSL` from that file so a shell or other `.env` does not win.
 */
function loadMigrateEnvFromRepoRoot(): void {
  const rootDir = getMonorepoRootDir(__dirname)
  const envPath = path.join(rootDir, '.env')

  if (!existsSync(envPath)) {
    const examplePath = path.join(rootDir, '.env.example')
    throw new Error(
      `Missing ${envPath}. Create it (e.g. copy ${examplePath} to .env at the repo root).`
    )
  }

  const vars = parseEnvFile(envPath)

  if (vars.DATABASE_URL !== undefined && vars.DATABASE_URL !== '') {
    process.env.DATABASE_URL = vars.DATABASE_URL
  }
  if (vars.DATABASE_SSL !== undefined && vars.DATABASE_SSL !== '') {
    process.env.DATABASE_SSL = vars.DATABASE_SSL
  }
}

loadMigrateEnvFromRepoRoot()

const migrationsFolder = path.join(__dirname, '..', 'migrations')

/**
 * Ensure the target database exists by connecting to the server's default
 * `postgres` database and issuing `CREATE DATABASE` if needed. Idempotent.
 */
async function ensureDatabaseExists(): Promise<void> {
  const conn = process.env.DATABASE_URL?.trim()
  if (!conn) {
    throw new Error('DATABASE_URL is not set')
  }

  const url = new URL(conn)
  const targetDb = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!targetDb) {
    throw new Error(`DATABASE_URL is missing a database name: ${conn}`)
  }

  const adminUrl = new URL(conn)
  adminUrl.pathname = '/postgres'

  const baseConfig = getPoolConfig()
  const client = new Client({
    connectionString: adminUrl.toString(),
    ssl: baseConfig.ssl,
  })

  await client.connect()
  try {
    const { rows } = await client.query<{ exists: boolean }>(
      'SELECT 1 AS exists FROM pg_database WHERE datname = $1',
      [targetDb]
    )
    if (rows.length === 0) {
      console.log(`▶ creating database "${targetDb}"`)
      const quoted = `"${targetDb.replace(/"/g, '""')}"`
      await client.query(`CREATE DATABASE ${quoted}`)
    }
  } finally {
    await client.end()
  }
}

async function main(): Promise<void> {
  await ensureDatabaseExists()

  const pool = new Pool(getPoolConfig())
  console.log('▶ migrating hidrosync')
  await migrate(drizzle(pool), { migrationsFolder })
  console.log('✓ hidrosync')
  await pool.end()
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e)
    process.exit(1)
  })
