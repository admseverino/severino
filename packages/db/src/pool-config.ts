import type { PoolConfig } from 'pg'

const isProduction = process.env.NODE_ENV === 'production'

export const poolTiming = {
  max: isProduction ? 5 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
} as const

function sslForUrl(connectionString: string): boolean | { rejectUnauthorized: false } {
  if (process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false }
  }
  if (process.env.DATABASE_SSL === 'false') {
    return false
  }
  if (connectionString.includes('/cloudsql/')) {
    return false
  }
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    return false
  }
  if (connectionString.includes('sslmode=require')) {
    return { rejectUnauthorized: false }
  }
  if (connectionString.includes('sslmode=disable')) {
    return false
  }
  return isProduction ? { rejectUnauthorized: false } : false
}

/**
 * Build a Cloud SQL unix-socket URL from env vars (Cloud Run / GCP).
 * Used when DATABASE_URL is not set — local dev keeps using DATABASE_URL directly.
 */
export function databaseUrlFromCloudSqlEnv(): string | null {
  const instance = process.env.INSTANCE_CONNECTION_NAME?.trim()
  const user = process.env.DB_USER?.trim()
  const pass = process.env.DB_PASS?.trim()
  const name = process.env.DB_NAME?.trim()
  if (!instance || !user || !pass || !name) {
    return null
  }
  const encodedUser = encodeURIComponent(user)
  const encodedPass = encodeURIComponent(pass)
  return `postgresql://${encodedUser}:${encodedPass}@/${name}?host=/cloudsql/${instance}`
}

export function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL?.trim()
  if (direct) {
    return direct
  }
  const fromCloudSql = databaseUrlFromCloudSqlEnv()
  if (fromCloudSql) {
    return fromCloudSql
  }
  throw new Error(
    'Database connection not configured: set DATABASE_URL or INSTANCE_CONNECTION_NAME, DB_USER, DB_PASS, and DB_NAME'
  )
}

export function getPoolConfig(): PoolConfig {
  const conn = resolveDatabaseUrl()
  return {
    connectionString: conn,
    ...poolTiming,
    ssl: sslForUrl(conn),
  }
}
