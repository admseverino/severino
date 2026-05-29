import type { EventId } from '../whatsapp/types.js'

/** Payload published to the worker (Pub/Sub or direct). */
export interface PublishedEvent {
  eventId: EventId
  signature: string | null
  payload: unknown
  rawBody: string
}
