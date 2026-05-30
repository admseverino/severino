import { z } from 'zod'
import { DrizzleEventStore } from '../adapters/drizzle-event-store.js'
import { DrizzleMessageStore } from '../adapters/drizzle-message-store.js'
import { log } from '../observability/log.js'
import { processWebhookEvent, processWebhookPayload } from '../whatsapp/process-event.js'
import { asEventId } from '../whatsapp/types.js'

const PubSubPushSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string().optional(),
})

const EventIdOnlySchema = z.object({
  eventId: z.string().min(1),
})

const DevMirrorMessageSchema = z.object({
  eventId: z.string().min(1),
  payload: z.unknown(),
  signature: z.string().nullable().optional(),
})

const eventStore = new DrizzleEventStore()
const messageStore = new DrizzleMessageStore()

function parsePubSubMessageData(decoded: string): {
  eventId: ReturnType<typeof asEventId>
  payload?: unknown
  signature?: string | null
} {
  const json: unknown = JSON.parse(decoded)
  const mirror = DevMirrorMessageSchema.safeParse(json)
  if (mirror.success) {
    return {
      eventId: asEventId(mirror.data.eventId),
      payload: mirror.data.payload,
      signature: mirror.data.signature ?? null,
    }
  }
  const idOnly = EventIdOnlySchema.parse(json)
  return { eventId: asEventId(idOnly.eventId) }
}

export async function handlePubSubPush(body: unknown): Promise<void> {
  const envelope = PubSubPushSchema.parse(body)
  const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf8')
  const { eventId, payload, signature } = parsePubSubMessageData(decoded)

  const deps = { eventStore, messageStore }

  if (payload !== undefined) {
    log.info('processing dev-mirror message (payload inline, local event stub)', {
      eventId,
      subscription: envelope.subscription,
    })
    await processWebhookPayload(eventId, payload, deps, {
      trackInEventStore: false,
      signature,
    })
    return
  }

  await processWebhookEvent(eventId, deps)
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
