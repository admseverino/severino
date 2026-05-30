import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { listUserMessages } from '@/modules/user-messages'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const messages = await listUserMessages(session.user.id)

  return NextResponse.json({
    messages: messages.map((message) => ({
      id: message.id,
      textBody: message.textBody,
      waTimestamp: message.waTimestamp.toISOString(),
      createdAt: message.createdAt.toISOString(),
    })),
  })
}
