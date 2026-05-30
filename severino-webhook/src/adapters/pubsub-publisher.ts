import { PubSub } from '@google-cloud/pubsub'
import type { EventPublisher, PublishEnvelope } from '../ports/event-publisher.js'
import type { EventId } from '../whatsapp/types.js'

export class PubSubEventPublisher implements EventPublisher {
  private readonly client: PubSub
  private readonly topicName: string
  private readonly mirrorTopicName: string | undefined

  constructor(projectId: string, topicName: string, mirrorTopicName?: string) {
    this.client = new PubSub({ projectId })
    this.topicName = topicName
    this.mirrorTopicName = mirrorTopicName?.trim() || undefined
  }

  async publish(eventId: EventId, envelope?: PublishEnvelope): Promise<void> {
    const primary = Buffer.from(JSON.stringify({ eventId }))
    await this.client.topic(this.topicName).publishMessage({ data: primary })

    if (this.mirrorTopicName && envelope) {
      const mirror = Buffer.from(
        JSON.stringify({
          eventId,
          payload: envelope.payload,
          signature: envelope.signature,
        })
      )
      await this.client.topic(this.mirrorTopicName).publishMessage({ data: mirror })
    }
  }
}
