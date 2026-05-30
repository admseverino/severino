import { desc, eq } from 'drizzle-orm'

import { db, schema } from '@severino/db'

const { userMessages } = schema

export interface UserMessageRow {
  id: string
  textBody: string | null
  waTimestamp: Date
  createdAt: Date
}

export async function listUserMessages(userId: string, limit = 50): Promise<UserMessageRow[]> {
  return db()
    .select({
      id: userMessages.id,
      textBody: userMessages.textBody,
      waTimestamp: userMessages.waTimestamp,
      createdAt: userMessages.createdAt,
    })
    .from(userMessages)
    .where(eq(userMessages.userId, userId))
    .orderBy(desc(userMessages.waTimestamp))
    .limit(limit)
}
