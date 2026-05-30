import type { EventPublisher, PublishEnvelope } from '../ports/event-publisher.js'
import { log } from '../observability/log.js'
import type { EventId } from '../whatsapp/types.js'

export class DirectEventPublisher implements EventPublisher {
  constructor(private readonly workerUrl: string) {}

  async publish(eventId: EventId, envelope?: PublishEnvelope): Promise<void> {
    const body = envelope
      ? { eventId, payload: envelope.payload, signature: envelope.signature }
      : { eventId }

    const pushBody = {
      message: {
        data: Buffer.from(JSON.stringify(body)).toString('base64'),
        messageId: `local-${eventId}`,
        publishTime: new Date().toISOString(),
      },
      subscription: 'local-direct',
    }

    const res = await fetch(`${this.workerUrl.replace(/\/$/, '')}/pubsub/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushBody),
    })

    if (!res.ok) {
      const text = await res.text()
      log.error('direct publisher failed', { eventId, status: res.status, body: text })
      throw new Error(`Direct publish failed: ${res.status}`)
    }
  }
}
