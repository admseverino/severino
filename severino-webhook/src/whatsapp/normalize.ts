import type { WhatsAppWebhookBody, WhatsAppMessageWire, WhatsAppValueWire } from './schema.js'
import {
  asEventId,
  asMsisdn,
  asPhoneNumberId,
  asWamid,
  type EventId,
  type NormalizedWhatsAppMessage,
  type WhatsAppMessageType,
} from './types.js'

const KNOWN_MESSAGE_TYPES = new Set<WhatsAppMessageType>([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'sticker',
  'location',
  'contacts',
  'button',
  'interactive',
  'reaction',
  'order',
  'system',
])

function toMessageType(type: string): WhatsAppMessageType {
  if (KNOWN_MESSAGE_TYPES.has(type as WhatsAppMessageType)) {
    return type as WhatsAppMessageType
  }
  return 'unknown'
}

function contactNameForSender(value: WhatsAppValueWire, from: string): string | null {
  const contact = value.contacts?.find((c) => c.wa_id === from)
  return contact?.profile?.name ?? null
}

function normalizeMessage(
  eventId: EventId,
  wabaId: string,
  value: WhatsAppValueWire,
  message: WhatsAppMessageWire
): NormalizedWhatsAppMessage {
  const tsSeconds = Number.parseInt(message.timestamp, 10)
  const waTimestamp = Number.isFinite(tsSeconds) ? new Date(tsSeconds * 1000) : new Date()

  return {
    eventId,
    wamid: asWamid(message.id),
    wabaId,
    phoneNumberId: asPhoneNumberId(value.metadata.phone_number_id),
    fromMsisdn: asMsisdn(message.from),
    contactName: contactNameForSender(value, message.from),
    messageType: toMessageType(message.type),
    textBody: message.type === 'text' && message.text?.body ? message.text.body : null,
    payload: message as Record<string, unknown>,
    waTimestamp,
  }
}

export function normalizeWebhookBody(
  eventId: EventId,
  body: WhatsAppWebhookBody
): NormalizedWhatsAppMessage[] {
  const brandedEventId = asEventId(eventId)
  const out: NormalizedWhatsAppMessage[] = []

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') {
        continue
      }
      const messages = change.value.messages ?? []
      for (const message of messages) {
        out.push(normalizeMessage(brandedEventId, entry.id, change.value, message))
      }
    }
  }

  return out
}

export function hasOnlyStatusUpdates(body: WhatsAppWebhookBody): boolean {
  let hasMessages = false
  let hasStatuses = false

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if ((change.value.messages?.length ?? 0) > 0) {
        hasMessages = true
      }
      if ((change.value.statuses?.length ?? 0) > 0) {
        hasStatuses = true
      }
    }
  }

  return hasStatuses && !hasMessages
}
