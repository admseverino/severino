import { sql } from 'drizzle-orm'
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const whatsappMessageTypeEnum = pgEnum('whatsapp_message_type', [
  'text',
  'image',
  'audio',
  'video',
  'document',
  'sticker',
  'location',
  'contacts',
  'button',
  'interactive',
  'reaction',
  'order',
  'system',
  'unknown',
])

export const whatsappProcessingStatusEnum = pgEnum('whatsapp_processing_status', [
  'received',
  'handled',
  'ignored',
  'failed',
])

export const whatsappEvents = pgTable(
  'whatsapp_events',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    signature: text('signature'),
    payload: jsonb('payload').notNull(),
    rawBody: text('raw_body'),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    processError: text('process_error'),
    processAttempts: integer('process_attempts').notNull().default(0),
  },
  (t) => [
    index('whatsapp_events_received_at').on(t.receivedAt),
    index('whatsapp_events_unprocessed')
      .on(t.receivedAt)
      .where(sql`${t.processedAt} is null`),
  ]
)

export const whatsappMessages = pgTable(
  'whatsapp_messages',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    eventId: text('event_id')
      .notNull()
      .references(() => whatsappEvents.id, { onDelete: 'restrict' }),
    wamid: text('wamid').notNull(),
    wabaId: text('waba_id'),
    phoneNumberId: text('phone_number_id').notNull(),
    fromMsisdn: text('from_msisdn').notNull(),
    contactName: text('contact_name'),
    messageType: whatsappMessageTypeEnum('message_type').notNull(),
    textBody: text('text_body'),
    payload: jsonb('payload').notNull(),
    waTimestamp: timestamp('wa_timestamp', { withTimezone: true, mode: 'date' }).notNull(),
    status: whatsappProcessingStatusEnum('status').notNull().default('received'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('whatsapp_messages_wamid').on(t.wamid),
    index('whatsapp_messages_number_ts').on(t.phoneNumberId, t.waTimestamp),
    index('whatsapp_messages_from_ts').on(t.fromMsisdn, t.waTimestamp),
    index('whatsapp_messages_failed')
      .on(t.status)
      .where(sql`${t.status} = 'failed'`),
  ]
)
