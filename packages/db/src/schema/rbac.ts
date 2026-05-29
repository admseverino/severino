import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'
import { units } from './units.js'
import { users } from './auth.js'

export const condoRoleEnum = pgEnum('condo_role', [
  'system_admin',
  'multi_condo_admin',
  'condo_admin',
  'condo_operator',
  'condo_editor',
])

export const userCondoGrants = pgTable(
  'user_condo_grants',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    condoId: text('condo_id').references(() => condos.id, { onDelete: 'cascade' }),
    role: condoRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('user_condo_grants_user_condo_role_key').on(t.userId, t.condoId, t.role)]
)

export const userUnitGrants = pgTable(
  'user_unit_grants',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('user_unit_grants_user_unit_key').on(t.userId, t.unitId)]
)
