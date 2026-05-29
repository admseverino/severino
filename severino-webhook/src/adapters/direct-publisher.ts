import type { EventPublisher } from '../ports/event-publisher.js'
import { log } from '../observability/log.js'
import type { EventId } from '../whatsapp/types.js'

export class DirectEventPublisher implements EventPublisher {
  constructor(private readonly workerUrl: string) {}

  async publish(eventId: EventId): Promise<void> {
    const envelope = {
      message: {
        data: Buffer.from(JSON.stringify({ eventId })).toString('base64'),
        messageId: `local-${eventId}`,
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
      log.error('direct publisher failed', { eventId, status: res.status, body })
      throw new Error(`Direct publish failed: ${res.status}`)
    }
  }
}
