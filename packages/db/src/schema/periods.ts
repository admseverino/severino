import { sql } from 'drizzle-orm'
import { integer, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'

export const periodStateEnum = pgEnum('period_state', [
  'scheduled',
  'reading_open',
  'review',
  'closed',
  'billed',
  'archived',
])

export const periods = pgTable(
  'periods',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    condoId: text('condo_id')
      .notNull()
      .references(() => condos.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    state: periodStateEnum('state').notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('periods_condo_year_month_key').on(t.condoId, t.year, t.month)]
)
