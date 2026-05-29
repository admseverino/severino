import { sql } from 'drizzle-orm'
import { numeric, pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { meters } from './meters.js'
import { periods } from './periods.js'

export const consumptionKindEnum = pgEnum('consumption_kind', ['unit', 'common_area'])

export const consumption = pgTable(
  'consumption',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    meterId: text('meter_id')
      .notNull()
      .references(() => meters.id, { onDelete: 'cascade' }),
    periodId: text('period_id')
      .notNull()
      .references(() => periods.id, { onDelete: 'cascade' }),
    value: numeric('value', { precision: 18, scale: 6 }).notNull(),
    kind: consumptionKindEnum('kind').notNull().default('unit'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('consumption_meter_period_key').on(t.meterId, t.periodId)]
)
