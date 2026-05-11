import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { isStaffRole } from '@/lib/admin-rbac'
import { commitSchema } from '@/lib/validation/onboarding'
import { commitOnboarding } from '@/modules/onboarding'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = commitSchema.safeParse(bodyJson)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  try {
    const result = await commitOnboarding({
      actorId: session.user.id,
      sessionId: parsed.data.sessionId,
    })
    return NextResponse.json({
      condoId: result.condoId,
      condoSlug: result.condoSlug,
      counts: result.counts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao concluir onboarding'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
