import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'

export const groupKindEnum = pgEnum('group_kind', ['floor', 'tower', 'block', 'villa_cluster', 'custom'])

export const groups = pgTable('groups', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  condoId: text('condo_id')
    .notNull()
    .references(() => condos.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: groupKindEnum('kind').notNull().default('custom'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
