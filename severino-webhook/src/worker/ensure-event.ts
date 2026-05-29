import type { EventStore } from '../ports/event-store.js'
import type { PublishedEvent } from '../ports/published-event.js'
import type { EventId } from '../whatsapp/types.js'

/** Backward-compatible: old messages carried only `{ eventId }`. */
export type WorkerEventMessage = Partial<
  Pick<PublishedEvent, 'signature' | 'payload' | 'rawBody'>
> & {
  eventId: string
}

export async function ensureEventInStore(
  eventId: EventId,
  source: WorkerEventMessage,
  eventStore: EventStore
): Promise<void> {
  const existing = await eventStore.loadById(eventId)
  if (existing) {
    return
  }

  if (source.payload === undefined) {
    throw new Error(`Event not found: ${eventId}`)
  }

  await eventStore.insertWithId(eventId, {
    signature: source.signature ?? null,
    payload: source.payload,
    rawBody: source.rawBody ?? '',
  })
}
