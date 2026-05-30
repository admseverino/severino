import { inArray } from 'drizzle-orm'
import { db, schema } from '@severino/db'

import type { MessageStore, StoredWhatsAppMessage } from '../ports/message-store.js'
import type { NormalizedWhatsAppMessage } from '../whatsapp/types.js'
import { asMsisdn, asWamid } from '../whatsapp/types.js'

export class DrizzleMessageStore implements MessageStore {
  async upsertMessages(messages: NormalizedWhatsAppMessage[]): Promise<StoredWhatsAppMessage[]> {
    if (messages.length === 0) {
      return []
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

    await db()
      .insert(schema.whatsappMessages)
      .values(rows)
      .onConflictDoNothing({ target: schema.whatsappMessages.wamid })

    const wamids = messages.map((m) => m.wamid)
    const stored = await db()
      .select({
        id: schema.whatsappMessages.id,
        wamid: schema.whatsappMessages.wamid,
        fromMsisdn: schema.whatsappMessages.fromMsisdn,
        textBody: schema.whatsappMessages.textBody,
        waTimestamp: schema.whatsappMessages.waTimestamp,
      })
      .from(schema.whatsappMessages)
      .where(inArray(schema.whatsappMessages.wamid, wamids))

    return stored.map((row) => ({
      id: row.id,
      wamid: asWamid(row.wamid),
      fromMsisdn: asMsisdn(row.fromMsisdn),
      textBody: row.textBody,
      waTimestamp: row.waTimestamp,
    }))
  }
}
