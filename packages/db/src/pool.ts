import { Pool } from 'pg'
import { getPoolConfig } from './pool-config.js'

function isNextBuildTimeBlocked(): boolean {
  // Block only during Next.js compile; allow CLI scripts when NODE_ENV is unset.
  return process.env.NEXT_PHASE === 'phase-production-build'
}

let pool: Pool | null = null

export function getPool(): Pool {
  if (isNextBuildTimeBlocked()) {
    throw new Error('Database access not allowed during build time')
  }
  if (!pool) {
    pool = new Pool(getPoolConfig())
  }
  return pool
}
