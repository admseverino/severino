import { PubSub } from '@google-cloud/pubsub'
import type { EventPublisher } from '../ports/event-publisher.js'
import type { EventId } from '../whatsapp/types.js'

export class PubSubEventPublisher implements EventPublisher {
  private readonly client: PubSub
  private readonly topicName: string

  constructor(projectId: string, topicName: string) {
    this.client = new PubSub({ projectId })
    this.topicName = topicName
  }

  async publish(eventId: EventId): Promise<void> {
    const data = Buffer.from(JSON.stringify({ eventId }))
    await this.client.topic(this.topicName).publishMessage({ data })
  }
}
