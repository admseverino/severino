import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import * as repo from '@/lib/auth-repository'
import { isStaffRole } from '@/lib/admin-rbac'

export const dynamic = 'force-dynamic'

function serializeUser(row: repo.AdminUserListRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    emailVerified: row.emailVerified?.toISOString() ?? null,
    image: row.image,
    createdAt: row.createdAt?.toISOString() ?? null,
  }
}

export async function GET(): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!isStaffRole(session.user.role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const users = await repo.listUsersForAdmin()
  return NextResponse.json({
    users: users.map(serializeUser),
  })
}
