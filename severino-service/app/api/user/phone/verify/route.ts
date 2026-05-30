import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { phoneVerifySchema } from '@/lib/validation/phone'
import { PhoneVerificationError, verifyPhoneCode } from '@/modules/phone'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = phoneVerifySchema.safeParse(body)
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors
      return NextResponse.json(
        {
          error:
            fields.code?.[0] ?? fields.phone?.[0] ?? 'Dados inválidos',
        },
        { status: 400 }
      )
    }

    const result = await verifyPhoneCode(
      session.user.id,
      parsed.data.phone ?? null,
      parsed.data.code
    )

    return NextResponse.json({
      ok: true,
      phoneE164: result.phoneE164,
      phoneVerifiedAt: result.phoneVerifiedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('phone verify', error)
    return NextResponse.json({ error: 'Não foi possível verificar o telefone.' }, { status: 500 })
  }
}
