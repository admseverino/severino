/**
 * Backfill user_messages from existing whatsapp_messages for users with verified phones.
 *
 * Usage:
 *   DATABASE_URL=... tsx scripts/backfill-user-messages.ts
 */
import { and, eq, isNotNull } from 'drizzle-orm'

import { db, schema } from '@severino/db'
import { msisdnToE164 } from '@severino/phone'

async function main(): Promise<void> {
  const verifiedUsers = await db()
    .select({
      id: schema.users.id,
      phoneE164: schema.users.phoneE164,
    })
    .from(schema.users)
    .where(isNotNull(schema.users.phoneVerifiedAt))

  const phoneToUser = new Map<string, string>()
  for (const user of verifiedUsers) {
    if (user.phoneE164) {
      phoneToUser.set(user.phoneE164, user.id)
    }
  }

  const whatsappRows = await db()
    .select({
      id: schema.whatsappMessages.id,
      fromMsisdn: schema.whatsappMessages.fromMsisdn,
      textBody: schema.whatsappMessages.textBody,
      waTimestamp: schema.whatsappMessages.waTimestamp,
    })
    .from(schema.whatsappMessages)

  let linked = 0
  for (const row of whatsappRows) {
    const phoneE164 = msisdnToE164(row.fromMsisdn)
    if (!phoneE164) {
      continue
    }

    const userId = phoneToUser.get(phoneE164)
    if (!userId) {
      continue
    }

    const inserted = await db()
      .insert(schema.userMessages)
      .values({
        userId,
        whatsappMessageId: row.id,
        textBody: row.textBody,
        waTimestamp: row.waTimestamp,
      })
      .onConflictDoNothing({ target: schema.userMessages.whatsappMessageId })
      .returning({ id: schema.userMessages.id })

    linked += inserted.length
  }

  console.log(`Backfill complete. Linked ${linked} user_messages rows.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
