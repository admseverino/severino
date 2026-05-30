import type { EventId } from '../whatsapp/types.js'

export interface RawEventInput {
  signature: string | null
  payload: unknown
  rawBody: string
}

export interface StoredWebhookEvent {
  id: EventId
  payload: unknown
  processedAt: Date | null
  processAttempts: number
}

export interface EventStore {
  insertRaw(input: RawEventInput): Promise<EventId>
  /** Local dev mirror: satisfy whatsapp_messages FK without reading Cloud SQL. */
  ensureEventStub(eventId: EventId, payload: unknown, signature: string | null): Promise<void>
  loadById(eventId: EventId): Promise<StoredWebhookEvent | null>
  incrementProcessAttempts(eventId: EventId): Promise<void>
  markProcessed(eventId: EventId): Promise<void>
  markFailed(eventId: EventId, error: string): Promise<void>
}
