import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { users } from './auth.js'

export const auditLog = pgTable('audit_log', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  actorId: text('actor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
