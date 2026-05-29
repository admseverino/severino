import { z } from 'zod'
import { DrizzleEventStore } from '../adapters/drizzle-event-store.js'
import { DrizzleMessageStore } from '../adapters/drizzle-message-store.js'
import { log } from '../observability/log.js'
import { processWebhookEvent } from '../whatsapp/process-event.js'
import { asEventId } from '../whatsapp/types.js'

const PubSubPushSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
})

const EventMessageSchema = z.object({
  eventId: z.string().min(1),
})

const eventStore = new DrizzleEventStore()
const messageStore = new DrizzleMessageStore()

export async function handlePubSubPush(body: unknown): Promise<void> {
  const envelope = PubSubPushSchema.parse(body)
  const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf8')
  const { eventId } = EventMessageSchema.parse(JSON.parse(decoded) as unknown)

  await processWebhookEvent(asEventId(eventId), {
    eventStore,
    messageStore,
  })
}

export async function handlePubSubPushSafe(body: unknown): Promise<{ ok: boolean }> {
  try {
    await handlePubSubPush(body)
    return { ok: true }
  } catch (error) {
    log.error('worker failed to process event', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false }
  }
}
