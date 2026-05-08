import { sql } from 'drizzle-orm'
import { integer, numeric, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const missingReadingDefaultEnum = pgEnum('missing_reading_default', [
  'estimate',
  'carry_over',
  'extend',
])

export const condos = pgTable('condos', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const condoConfig = pgTable(
  'condo_config',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    condoId: text('condo_id')
      .notNull()
      .references(() => condos.id, { onDelete: 'cascade' })
      .unique(),
    logoImage: text('logo_image'),
    readingDay: integer('reading_day').notNull().default(1),
    readingWindowDays: integer('reading_window_days').notNull().default(7),
    reviewSlaDays: integer('review_sla_days').notNull().default(7),
    billingDay: integer('billing_day').notNull().default(15),
    deltaThresholdPct: numeric('delta_threshold_pct', { precision: 8, scale: 2 }).notNull().default('300'),
    ocrConfidenceFloor: numeric('ocr_confidence_floor', { precision: 4, scale: 3 }).notNull().default('0.7'),
    missingReadingDefault: missingReadingDefaultEnum('missing_reading_default').notNull().default('estimate'),
    extendDefaultDays: integer('extend_default_days').notNull().default(3),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  }
)
