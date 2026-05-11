import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { integer, pgEnum, pgTable, text, timestamp, unique, uniqueIndex } from 'drizzle-orm/pg-core'

import { condos } from './condos.js'
import { users } from './auth.js'
import { groupKindEnum } from './groups.js'
import { linkedMeterTargetKindEnum, meterKindEnum } from './meters.js'

/**
 * Onboarding workspace. Temp rows live until commit; re-running the prompt for the same session
 * fully regenerates the temp tables (see workflow §1: idempotent until committed).
 */
export const onboardingSessionStatusEnum = pgEnum('onboarding_session_status', ['draft', 'committed'])

export const onboardingSessions = pgTable('onboarding_sessions', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  actorId: text('actor_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  condoName: text('condo_name').notNull(),
  condoSlug: text('condo_slug').notNull(),
  logoImage: text('logo_image'),
  prompt: text('prompt').notNull(),
  status: onboardingSessionStatusEnum('status').notNull().default('draft'),
  committedCondoId: text('committed_condo_id').references(() => condos.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const tempGroups = pgTable(
  'temp_groups',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    sessionId: text('session_id')
      .notNull()
      .references(() => onboardingSessions.id, { onDelete: 'cascade' }),
    parentTempGroupId: text('parent_temp_group_id').references((): AnyPgColumn => tempGroups.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    kind: groupKindEnum('kind').notNull().default('custom'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('temp_groups_session_root_name_key')
      .on(t.sessionId, t.name)
      .where(sql`${t.parentTempGroupId} is null`),
    uniqueIndex('temp_groups_session_parent_name_key')
      .on(t.sessionId, t.parentTempGroupId, t.name)
      .where(sql`${t.parentTempGroupId} is not null`),
  ]
)

export const tempUnits = pgTable(
  'temp_units',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    sessionId: text('session_id')
      .notNull()
      .references(() => onboardingSessions.id, { onDelete: 'cascade' }),
    tempGroupId: text('temp_group_id').references(() => tempGroups.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('temp_units_session_label_key').on(t.sessionId, t.label)]
)

/**
 * Polymorphic temp row: `targetKind` decides which of the FKs is meaningful.
 *  - `unit`  → `targetTempUnitId` set
 *  - `group` → `targetTempGroupId` set
 *  - `condo` → both null (target is the condo created at commit time)
 */
export const tempMeters = pgTable('temp_meters', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  sessionId: text('session_id')
    .notNull()
    .references(() => onboardingSessions.id, { onDelete: 'cascade' }),
  kind: meterKindEnum('kind').notNull(),
  identifier: text('identifier'),
  targetKind: linkedMeterTargetKindEnum('target_kind').notNull(),
  targetTempUnitId: text('target_temp_unit_id').references(() => tempUnits.id, { onDelete: 'cascade' }),
  targetTempGroupId: text('target_temp_group_id').references(() => tempGroups.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})
