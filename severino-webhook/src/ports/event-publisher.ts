import type { EventId } from '../whatsapp/types.js'

export interface EventPublisher {
  publish(eventId: EventId): Promise<void>
}
