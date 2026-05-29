import { sql } from 'drizzle-orm'
import { numeric, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'
import { groups } from './groups.js'

export const units = pgTable(
  'units',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    condoId: text('condo_id')
      .notNull()
      .references(() => condos.id, { onDelete: 'cascade' }),
    groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    deltaThresholdPctOverride: numeric('delta_threshold_pct_override', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('units_condo_label_key').on(t.condoId, t.label)]
)
