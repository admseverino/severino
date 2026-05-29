import bcrypt from 'bcryptjs'

import * as repo from '@/lib/auth-repository'
import { userForAudit, writeAudit } from '@/modules/audit/log'

const BCRYPT_ROUNDS = 12

/**
 * Same path the app uses for accounts: {@link repo.findUserByEmail}, {@link repo.updateUser},
 * {@link repo.createCredentialsUser} (normalized email, consistent role/password columns).
 */
export async function upsertSystemAdminUser(options: {
  email: string
  password: string
  displayName?: string
}): Promise<'created' | 'updated'> {
  const passwordHash = await bcrypt.hash(options.password, BCRYPT_ROUNDS)
  const existing = await repo.findUserByEmail(options.email)

  if (existing) {
    const updated = await repo.updateUser(existing.id, {
      password: passwordHash,
      role: 'system_admin',
    })
    if (!updated) {
      throw new Error('Failed to update system admin user')
    }
    await writeAudit({
      actor: updated.id,
      entity: 'user',
      entityId: updated.id,
      action: 'user.system_admin_upsert',
      before: userForAudit(existing),
      after: userForAudit(updated),
    })
    return 'updated'
  }

  const created = await repo.createCredentialsUser({
    email: options.email,
    name: options.displayName ?? 'System Admin',
    passwordHash,
    role: 'system_admin',
  })
  await writeAudit({
    actor: created.id,
    entity: 'user',
    entityId: created.id,
    action: 'user.system_admin_bootstrap_create',
    before: null,
    after: userForAudit(created),
  })
  return 'created'
}
