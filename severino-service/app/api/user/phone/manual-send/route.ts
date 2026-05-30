import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { phoneManualSendSchema } from '@/lib/validation/phone'
import {
  PhoneVerificationError,
  requestPhoneVerificationByDirectMessage,
} from '@/modules/phone'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = phoneManualSendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors.phone?.[0] ?? 'Dados inválidos' },
        { status: 400 }
      )
    }

    const result = await requestPhoneVerificationByDirectMessage(session.user.id, parsed.data.phone)
    return NextResponse.json({
      ok: true,
      phoneE164: result.phoneE164,
      requestedAt: result.requestedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('phone manual send', error)
    return NextResponse.json({ error: 'Não foi possível enviar o código.' }, { status: 500 })
  }
}
