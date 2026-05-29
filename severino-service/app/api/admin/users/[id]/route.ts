import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { validateUserDelete, validateUserUpdate } from '@/lib/admin-rbac'
import * as repo from '@/lib/auth-repository'
import { userForAudit, writeAudit } from '@/modules/audit/log'

export const dynamic = 'force-dynamic'

const updateBodySchema = z.object({
  name: z.union([z.string().max(200), z.null()]).optional(),
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'system_admin']),
})

export async function PUT(
  request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id: targetId } = context.params
  const target = await repo.findUserById(targetId)
  if (!target) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = updateBodySchema.safeParse(bodyJson)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const rawName = parsed.data.name
  const body = {
    name: typeof rawName === 'string' ? rawName : rawName === null ? '' : '',
    email: parsed.data.email.trim(),
    role: parsed.data.role,
  }

  const systemAdminCount = await repo.countUsersWithRole('system_admin')

  const check = validateUserUpdate({
    actorId: session.user.id,
    actorRole: session.user.role,
    target: { id: target.id, role: target.role, email: target.email },
    body,
    systemAdminCount,
  })
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  if (body.email !== target.email) {
    const other = await repo.findUserByEmail(body.email)
    if (other && other.id !== target.id) {
      return NextResponse.json({ error: 'E-mail já em uso' }, { status: 409 })
    }
  }

  const updated = await repo.updateUser(target.id, {
    name: body.name.length > 0 ? body.name : null,
    email: body.email,
    role: body.role,
  })

  if (!updated) {
    return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 })
  }

  await writeAudit({
    actor: session.user.id,
    entity: 'user',
    entityId: updated.id,
    action: 'user.admin_update',
    before: userForAudit(target),
    after: userForAudit(updated),
  })

  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      emailVerified: updated.emailVerified?.toISOString() ?? null,
      image: updated.image,
      createdAt: updated.createdAt?.toISOString() ?? null,
    },
  })
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id: targetId } = context.params
  const target = await repo.findUserById(targetId)
  if (!target) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const systemAdminCount = await repo.countUsersWithRole('system_admin')

  const check = validateUserDelete({
    actorId: session.user.id,
    actorRole: session.user.role,
    target: { id: target.id, role: target.role },
    systemAdminCount,
  })
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  await writeAudit({
    actor: session.user.id,
    entity: 'user',
    entityId: target.id,
    action: 'user.admin_delete',
    before: userForAudit(target),
    after: null,
  })

  await repo.deleteUser(target.id)
  return NextResponse.json({ ok: true })
}
