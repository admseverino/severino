import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'

export const meterKindEnum = pgEnum('meter_kind', ['submeter', 'master'])
export const meterStatusEnum = pgEnum('meter_status', ['active', 'retired'])
export const linkedMeterTargetKindEnum = pgEnum('linked_meter_target_kind', ['unit', 'group', 'condo'])

export const meters = pgTable('meters', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  condoId: text('condo_id')
    .notNull()
    .references(() => condos.id, { onDelete: 'cascade' }),
  kind: meterKindEnum('kind').notNull(),
  status: meterStatusEnum('status').notNull().default('active'),
  utility: text('utility').notNull().default('water'),
  identifier: text('identifier'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const linkedMeters = pgTable(
  'linked_meters',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    meterId: text('meter_id')
      .notNull()
      .references(() => meters.id, { onDelete: 'cascade' }),
    targetKind: linkedMeterTargetKindEnum('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('linked_meters_meter_target_key').on(t.meterId, t.targetKind, t.targetId)]
)
