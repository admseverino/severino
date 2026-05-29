import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'

export const groupKindEnum = pgEnum('group_kind', ['floor', 'tower', 'block', 'villa_cluster', 'custom'])

export const groups = pgTable(
  'groups',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    condoId: text('condo_id')
      .notNull()
      .references(() => condos.id, { onDelete: 'cascade' }),
    /** Null = root group. Max tree depth (root inclusive) is enforced in app (4). */
    parentGroupId: text('parent_group_id').references((): AnyPgColumn => groups.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    kind: groupKindEnum('kind').notNull().default('custom'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('groups_condo_id_parent_null_name_key')
      .on(t.condoId, t.name)
      .where(sql`${t.parentGroupId} is null`),
    uniqueIndex('groups_condo_id_parent_name_key')
      .on(t.condoId, t.parentGroupId, t.name)
      .where(sql`${t.parentGroupId} is not null`),
  ]
)
