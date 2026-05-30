import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { PhoneVerificationError, removeVerifiedPhone } from '@/modules/phone'

export const dynamic = 'force-dynamic'

export async function DELETE(): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    await removeVerifiedPhone(session.user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PhoneVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('phone remove', error)
    return NextResponse.json({ error: 'Não foi possível remover o telefone.' }, { status: 500 })
  }
}
