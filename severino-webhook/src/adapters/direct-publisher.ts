import type { EventPublisher } from '../ports/event-publisher.js'
import type { PublishedEvent } from '../ports/published-event.js'
import { log } from '../observability/log.js'

export class DirectEventPublisher implements EventPublisher {
  constructor(private readonly workerUrl: string) {}

  async publish(event: PublishedEvent): Promise<void> {
    const envelope = {
      message: {
        data: Buffer.from(JSON.stringify(event)).toString('base64'),
        messageId: `local-${event.eventId}`,
        publishTime: new Date().toISOString(),
      },
      subscription: 'local-direct',
    }

    const res = await fetch(`${this.workerUrl.replace(/\/$/, '')}/pubsub/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    })

    if (!res.ok) {
      const body = await res.text()
      log.error('direct publisher failed', { eventId: event.eventId, status: res.status, body })
      throw new Error(`Direct publish failed: ${res.status}`)
    }
  }
}
