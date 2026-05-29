import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema/index.js'
import { getPool } from './pool.js'

export function db() {
  return drizzle(getPool(), { schema })
}

export type Db = ReturnType<typeof db>
