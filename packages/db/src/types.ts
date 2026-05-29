import type { users } from './schema/auth.js'

export type UserRow = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert
