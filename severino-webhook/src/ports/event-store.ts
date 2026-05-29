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
  /** Insert with a known id (e.g. replayed from Pub/Sub when the row lives in another DB). */
  insertWithId(eventId: EventId, input: RawEventInput): Promise<EventId>
  loadById(eventId: EventId): Promise<StoredWebhookEvent | null>
  incrementProcessAttempts(eventId: EventId): Promise<void>
  markProcessed(eventId: EventId): Promise<void>
  markFailed(eventId: EventId, error: string): Promise<void>
}
