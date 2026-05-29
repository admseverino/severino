import { sql } from 'drizzle-orm'
import { integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

import { users } from './auth.js'
import { periods } from './periods.js'

export const billingExports = pgTable(
  'billing_exports',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    periodId: text('period_id')
      .notNull()
      .references(() => periods.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    csvPath: text('csv_path').notNull(),
    exportedBy: text('exported_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    exportedAt: timestamp('exported_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('billing_exports_period_version_key').on(t.periodId, t.version)]
)
