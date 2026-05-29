import { PubSub } from '@google-cloud/pubsub'
import type { EventPublisher } from '../ports/event-publisher.js'
import type { PublishedEvent } from '../ports/published-event.js'

export class PubSubEventPublisher implements EventPublisher {
  private readonly client: PubSub
  private readonly topicName: string

  constructor(projectId: string, topicName: string) {
    this.client = new PubSub({ projectId })
    this.topicName = topicName
  }

  async publish(event: PublishedEvent): Promise<void> {
    const data = Buffer.from(JSON.stringify(event))
    await this.client.topic(this.topicName).publishMessage({ data })
  }
}
