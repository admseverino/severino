import { db, schema } from '@severino/db'
import type { MessageStore } from '../ports/message-store.js'
import type { NormalizedWhatsAppMessage } from '../whatsapp/types.js'

export class DrizzleMessageStore implements MessageStore {
  async upsertMessages(messages: NormalizedWhatsAppMessage[]): Promise<number> {
    if (messages.length === 0) {
      return 0
    }

    const rows = messages.map((m) => ({
      eventId: m.eventId,
      wamid: m.wamid,
      wabaId: m.wabaId,
      phoneNumberId: m.phoneNumberId,
      fromMsisdn: m.fromMsisdn,
      contactName: m.contactName,
      messageType: m.messageType,
      textBody: m.textBody,
      payload: m.payload,
      waTimestamp: m.waTimestamp,
      status: 'received' as const,
    }))

    const inserted = await db()
      .insert(schema.whatsappMessages)
      .values(rows)
      .onConflictDoNothing({ target: schema.whatsappMessages.wamid })
      .returning({ id: schema.whatsappMessages.id })

    return inserted.length
  }
}
