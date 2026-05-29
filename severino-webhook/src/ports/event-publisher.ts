import type { PublishedEvent } from './published-event.js'

export interface EventPublisher {
  publish(event: PublishedEvent): Promise<void>
}
