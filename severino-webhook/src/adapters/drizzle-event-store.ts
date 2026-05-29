import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@severino/db'
import type { EventStore, RawEventInput, StoredWebhookEvent } from '../ports/event-store.js'
import { asEventId, type EventId } from '../whatsapp/types.js'

export class DrizzleEventStore implements EventStore {
  async insertRaw(input: RawEventInput): Promise<EventId> {
    const rows = await db()
      .insert(schema.whatsappEvents)
      .values({
        signature: input.signature,
        payload: input.payload,
        rawBody: input.rawBody,
      })
      .returning({ id: schema.whatsappEvents.id })

    const row = rows[0]
    if (!row) {
      throw new Error('Failed to insert whatsapp event')
    }
    return asEventId(row.id)
  }

  async loadById(eventId: EventId): Promise<StoredWebhookEvent | null> {
    const rows = await db()
      .select({
        id: schema.whatsappEvents.id,
        payload: schema.whatsappEvents.payload,
        processedAt: schema.whatsappEvents.processedAt,
        processAttempts: schema.whatsappEvents.processAttempts,
      })
      .from(schema.whatsappEvents)
      .where(eq(schema.whatsappEvents.id, eventId))
      .limit(1)

    const row = rows[0]
    if (!row) {
      return null
    }

    return {
      id: asEventId(row.id),
      payload: row.payload,
      processedAt: row.processedAt,
      processAttempts: row.processAttempts,
    }
  }

  async incrementProcessAttempts(eventId: EventId): Promise<void> {
    await db()
      .update(schema.whatsappEvents)
      .set({
        processAttempts: sql`${schema.whatsappEvents.processAttempts} + 1`,
      })
      .where(eq(schema.whatsappEvents.id, eventId))
  }

  async markProcessed(eventId: EventId): Promise<void> {
    await db()
      .update(schema.whatsappEvents)
      .set({
        processedAt: new Date(),
        processError: null,
      })
      .where(eq(schema.whatsappEvents.id, eventId))
  }

  async markFailed(eventId: EventId, error: string): Promise<void> {
    await db()
      .update(schema.whatsappEvents)
      .set({
        processError: error,
      })
      .where(eq(schema.whatsappEvents.id, eventId))
  }
}
