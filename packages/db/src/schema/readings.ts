import { sql } from 'drizzle-orm'
import {
  boolean,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import { users } from './auth.js'
import { meters } from './meters.js'
import { periods } from './periods.js'

export const readingStatusEnum = pgEnum('reading_status', ['pending', 'approved', 'rejected', 'flagged'])

export const readings = pgTable(
  'readings',
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
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    value: numeric('value', { precision: 18, scale: 6 }).notNull(),
    aiValue: numeric('ai_value', { precision: 18, scale: 6 }),
    aiConfidence: numeric('ai_confidence', { precision: 5, scale: 4 }),
    photoPath: text('photo_path').notNull(),
    exifCaptureAt: timestamp('exif_capture_at', { withTimezone: true, mode: 'date' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    gpsLat: numeric('gps_lat', { precision: 10, scale: 7 }),
    gpsLng: numeric('gps_lng', { precision: 10, scale: 7 }),
    device: text('device'),
    status: readingStatusEnum('status').notNull().default('pending'),
    isFinal: boolean('is_final').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('readings_meter_period_when_not_rejected')
      .on(t.meterId, t.periodId)
      .where(sql`${t.status} <> 'rejected'`),
  ]
)
