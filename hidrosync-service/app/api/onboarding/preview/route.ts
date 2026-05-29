import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { isStaffRole } from '@/lib/admin-rbac'
import { previewSchema } from '@/lib/validation/onboarding'
import { normalizeSlug, previewFromPrompt } from '@/modules/onboarding'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  // Until per-condo RBAC lands (M0 cross-cutting task), only platform staff may onboard.
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = previewSchema.safeParse(bodyJson)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return NextResponse.json(
      { error: 'Dados inválidos', fields: flat.fieldErrors },
      { status: 400 }
    )
  }

  try {
    const result = await previewFromPrompt({
      actorId: session.user.id,
      sessionId: parsed.data.sessionId,
      condoName: parsed.data.condoName,
      condoSlug: normalizeSlug(parsed.data.condoSlug),
      prompt: parsed.data.prompt,
      logoImage: parsed.data.logoImage ?? null,
    })

    return NextResponse.json({
      session: {
        id: result.session.id,
        condoName: result.session.condoName,
        condoSlug: result.session.condoSlug,
        prompt: result.session.prompt,
        logoImage: result.session.logoImage,
        status: result.session.status,
        updatedAt: result.session.updatedAt.toISOString(),
      },
      groups: result.groups.map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind,
        sortOrder: g.sortOrder,
        parentTempGroupId: g.parentTempGroupId ?? null,
      })),
      units: result.units.map((u) => ({
        id: u.id,
        label: u.label,
        tempGroupId: u.tempGroupId,
        sortOrder: u.sortOrder,
      })),
      meters: result.meters.map((m) => ({
        id: m.id,
        kind: m.kind,
        targetKind: m.targetKind,
        targetTempUnitId: m.targetTempUnitId,
        targetTempGroupId: m.targetTempGroupId,
        identifier: m.identifier,
        sortOrder: m.sortOrder,
      })),
      warnings: result.warnings,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao processar a prévia'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
