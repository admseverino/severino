import { db, schema } from '@hidrosync/db'

import type { UserAccountRow } from '@/lib/auth-repository'

/** JSON-safe user snapshot; never includes password hash. */
export function userForAudit(user: UserAccountRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    image: user.image,
    createdAt: user.createdAt?.toISOString() ?? null,
    updatedAt: user.updatedAt?.toISOString() ?? null,
  }
}

export type WriteAuditInput = {
  actor: string
  entity: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
  reason?: string | null
}

/** Append-only audit row; call after successful mutating operations (see docs/development-plan.md). */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await db().insert(schema.auditLog).values({
    actorId: input.actor,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    before: input.before === undefined ? null : input.before,
    after: input.after === undefined ? null : input.after,
    reason: input.reason ?? null,
  })
}
