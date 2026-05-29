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

export function getPoolConfig(): PoolConfig {
  const conn = process.env.DATABASE_URL?.trim()
  if (!conn) {
    throw new Error('DATABASE_URL is not set')
  }
  return {
    connectionString: conn,
    ...poolTiming,
    ssl: sslForUrl(conn),
  }
}
