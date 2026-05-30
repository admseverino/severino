import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { phoneRequestSchema } from '@/lib/validation/phone'
import {
  getWhatsAppVerificationPhoneE164,
  PhoneVerificationError,
  requestPhoneVerification,
} from '@/modules/phone'
import { renderPhoneVerificationQr } from '@/modules/phone/qr'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = phoneRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const result = await requestPhoneVerification(session.user.id)
    const qrSvg = await renderPhoneVerificationQr(result.whatsappUrl)

    return NextResponse.json({
      ok: true,
      verificationCode: result.verificationCode,
      whatsappUrl: result.whatsappUrl,
      whatsappPhoneE164: getWhatsAppVerificationPhoneE164(),
      requestedAt: result.requestedAt.toISOString(),
      qrSvg,
    })
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('phone request', error)
    return NextResponse.json({ error: 'Não foi possível solicitar verificação.' }, { status: 500 })
  }
}
