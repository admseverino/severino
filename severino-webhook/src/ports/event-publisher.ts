import type { EventId } from '../whatsapp/types.js'

/** Optional envelope for dev-mirror topic (local worker processes without Cloud SQL). */
export interface PublishEnvelope {
  signature: string | null
  payload: unknown
  rawBody: string
}

export interface EventPublisher {
  publish(eventId: EventId, envelope?: PublishEnvelope): Promise<void>
}
