import type { AdminUserListRow } from '@/lib/auth-repository'

export const MANAGED_ROLES = ['user', 'admin', 'system_admin'] as const
export type ManagedRole = (typeof MANAGED_ROLES)[number]

export function isStaffRole(role: string | undefined): boolean {
  return role === 'admin' || role === 'system_admin'
}

export function isSystemAdminRole(role: string | undefined): boolean {
  return role === 'system_admin'
}

function isManagedRole(role: string): role is ManagedRole {
  return (MANAGED_ROLES as readonly string[]).includes(role)
}

export type ValidateUserUpdateResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Validates an admin/staff user update. Caller must enforce session and load target user.
 */
export function validateUserUpdate(input: {
  actorId: string
  actorRole: string
  target: Pick<AdminUserListRow, 'id' | 'role' | 'email'>
  body: { name: string; email: string; role: string }
  systemAdminCount: number
}): ValidateUserUpdateResult {
  const { actorId, actorRole, target, body, systemAdminCount } = input

  if (!isStaffRole(actorRole)) {
    return { ok: false, status: 403, error: 'Sem permissão' }
  }

  if (!isManagedRole(body.role)) {
    return { ok: false, status: 400, error: 'Papel inválido' }
  }

  if (actorRole === 'admin' && isSystemAdminRole(target.role)) {
    return { ok: false, status: 403, error: 'Não é permitido alterar superusuários' }
  }

  if (actorRole === 'admin') {
    if (body.role === 'system_admin') {
      return { ok: false, status: 403, error: 'Apenas superusuário pode atribuir este papel' }
    }
    if (target.role !== body.role) {
      const allowed =
        (target.role === 'user' || target.role === 'admin') && (body.role === 'user' || body.role === 'admin')
      if (!allowed) {
        return { ok: false, status: 403, error: 'Alteração de papel não permitida' }
      }
    }
  }

  if (actorRole === 'system_admin') {
    if (isSystemAdminRole(target.role) && body.role !== 'system_admin' && systemAdminCount <= 1) {
      return { ok: false, status: 403, error: 'Não é possível remover o último superusuário' }
    }
    if (target.id === actorId && isSystemAdminRole(target.role) && body.role !== 'system_admin') {
      if (systemAdminCount <= 1) {
        return { ok: false, status: 403, error: 'Não é possível remover o último superusuário' }
      }
    }
  }

  return { ok: true }
}

export type ValidateUserDeleteResult = ValidateUserUpdateResult

export function validateUserDelete(input: {
  actorId: string
  actorRole: string
  target: Pick<AdminUserListRow, 'id' | 'role'>
  systemAdminCount: number
}): ValidateUserDeleteResult {
  const { actorId, actorRole, target, systemAdminCount } = input

  if (!isStaffRole(actorRole)) {
    return { ok: false, status: 403, error: 'Sem permissão' }
  }

  if (actorRole === 'admin') {
    return { ok: false, status: 403, error: 'Apenas superusuário pode excluir contas' }
  }

  if (target.id === actorId) {
    return { ok: false, status: 403, error: 'Não é possível excluir a própria conta' }
  }

  if (isSystemAdminRole(target.role) && systemAdminCount <= 1) {
    return { ok: false, status: 403, error: 'Não é possível excluir o último superusuário' }
  }

  return { ok: true }
}
