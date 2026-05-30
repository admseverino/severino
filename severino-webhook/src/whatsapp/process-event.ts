import type { EventStore } from '../ports/event-store.js'
import type { MessageStore } from '../ports/message-store.js'
import type { PhoneVerificationProcessor } from '../ports/phone-verification-processor.js'
import type { UserMessageLinker } from '../ports/user-message-linker.js'
import { log } from '../observability/log.js'
import { hasOnlyStatusUpdates, normalizeWebhookBody } from './normalize.js'
import { WhatsAppWebhookBodySchema } from './schema.js'
import type { EventId } from './types.js'

export interface ProcessEventDeps {
  eventStore: EventStore
  messageStore: MessageStore
  phoneVerificationProcessor: PhoneVerificationProcessor
  userMessageLinker: UserMessageLinker
}

export interface ProcessPayloadOptions {
  /** When false, dev mirror: stub event row locally, no load from Cloud SQL. */
  trackInEventStore?: boolean
  /** Used with trackInEventStore=false for ensureEventStub. */
  signature?: string | null
}

export async function processWebhookPayload(
  eventId: EventId,
  payload: unknown,
  deps: ProcessEventDeps,
  options: ProcessPayloadOptions = {}
): Promise<void> {
  const track = options.trackInEventStore !== false

  if (!track) {
    await deps.eventStore.ensureEventStub(eventId, payload, options.signature ?? null)
  } else {
    await deps.eventStore.incrementProcessAttempts(eventId)
  }

  const parsed = WhatsAppWebhookBodySchema.safeParse(payload)
  if (!parsed.success) {
    const error = parsed.error.message
    await deps.eventStore.markFailed(eventId, error)
    throw new Error(`Invalid webhook payload: ${error}`)
  }

  if (hasOnlyStatusUpdates(parsed.data)) {
    await deps.eventStore.markProcessed(eventId)
    log.info('webhook event contained status updates only', { eventId, trackInEventStore: track })
    return
  }

  const messages = normalizeWebhookBody(eventId, parsed.data)
  const stored = await deps.messageStore.upsertMessages(messages)
  const verified = await deps.phoneVerificationProcessor.processInboundMessages(
    stored.map((message) => ({
      fromMsisdn: message.fromMsisdn,
      textBody: message.textBody,
    }))
  )
  const linked = await deps.userMessageLinker.linkRegisteredUserMessages(
    stored.map((message) => ({
      whatsappMessageId: message.id,
      fromMsisdn: message.fromMsisdn,
      textBody: message.textBody,
      waTimestamp: message.waTimestamp,
    }))
  )

  await deps.eventStore.markProcessed(eventId)

  log.info('webhook event processed', {
    eventId,
    messageCount: messages.length,
    storedCount: stored.length,
    verified,
    linked,
    trackInEventStore: track,
  })
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

  await processWebhookPayload(eventId, event.payload, deps, { trackInEventStore: true })
}
