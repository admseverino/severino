import type { EventStore } from '../ports/event-store.js'
import type { MessageStore } from '../ports/message-store.js'
import { log } from '../observability/log.js'
import { hasOnlyStatusUpdates, normalizeWebhookBody } from './normalize.js'
import { WhatsAppWebhookBodySchema } from './schema.js'
import type { EventId } from './types.js'

export interface ProcessEventDeps {
  eventStore: EventStore
  messageStore: MessageStore
}

export async function processWebhookEvent(
  eventId: EventId,
  deps: ProcessEventDeps
): Promise<void> {
  const event = await deps.eventStore.loadById(eventId)
  if (!event) {
    throw new Error(`Event not found: ${eventId}`)
  }

  if (event.processedAt) {
    log.info('webhook event already processed', { eventId })
    return
  }

  await deps.eventStore.incrementProcessAttempts(eventId)

  const parsed = WhatsAppWebhookBodySchema.safeParse(event.payload)
  if (!parsed.success) {
    const error = parsed.error.message
    await deps.eventStore.markFailed(eventId, error)
    throw new Error(`Invalid webhook payload: ${error}`)
  }

  if (hasOnlyStatusUpdates(parsed.data)) {
    await deps.eventStore.markProcessed(eventId)
    log.info('webhook event contained status updates only', { eventId })
    return
  }

  const messages = normalizeWebhookBody(eventId, parsed.data)
  const inserted = await deps.messageStore.upsertMessages(messages)

  await deps.eventStore.markProcessed(eventId)
  log.info('webhook event processed', { eventId, messageCount: messages.length, inserted })
}
