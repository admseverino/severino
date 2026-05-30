import { and, eq, isNotNull } from 'drizzle-orm'
import { db, schema } from '@severino/db'
import { msisdnToE164 } from '@severino/phone'

import type { UserMessageLinker, LinkableWhatsAppMessage } from '../ports/user-message-linker.js'

export class DrizzleUserMessageLinker implements UserMessageLinker {
  async linkRegisteredUserMessages(messages: LinkableWhatsAppMessage[]): Promise<number> {
    let linked = 0

    for (const message of messages) {
      const phoneE164 = msisdnToE164(message.fromMsisdn)
      if (!phoneE164) {
        continue
      }

      const matches = await db()
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(eq(schema.users.phoneE164, phoneE164), isNotNull(schema.users.phoneVerifiedAt))
        )

      if (matches.length !== 1) {
        continue
      }

      const userId = matches[0]?.id
      if (!userId) {
        continue
      }

      const inserted = await db()
        .insert(schema.userMessages)
        .values({
          userId,
          whatsappMessageId: message.whatsappMessageId,
          textBody: message.textBody,
          waTimestamp: message.waTimestamp,
        })
        .onConflictDoNothing({ target: schema.userMessages.whatsappMessageId })
        .returning({ id: schema.userMessages.id })

      linked += inserted.length
    }

    return linked
  }
}
