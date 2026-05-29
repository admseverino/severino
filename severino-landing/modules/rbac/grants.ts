import { and, asc, eq, inArray } from 'drizzle-orm'

import { db, schema } from '@severino/db'

import { isSystemAdminRole } from '@/lib/admin-rbac'

const { condos, userCondoGrants } = schema

/** Condo roles that grant read access to the meter/reading surfaces (everything except viewer). */
export const METER_SCOPE_ROLES = [
  'condo_admin',
  'multi_condo_admin',
  'condo_operator',
  'condo_editor',
] as const
export type MeterScopeRole = (typeof METER_SCOPE_ROLES)[number]

export interface AccessibleCondo {
  id: string
  name: string
  slug: string
}

/**
 * Condos the user may access for meter/reading purposes.
 *  - `system_admin` (platform role) sees every condo, regardless of `user_condo_grants` rows.
 *  - Everyone else: the condos where they hold any non-viewer grant.
 *
 * Viewers (tenants) are excluded — their surface is `/tenant` in M7, not `/meters`.
 */
export async function listAccessibleCondos(
  userId: string,
  role: string | undefined
): Promise<AccessibleCondo[]> {
  if (isSystemAdminRole(role)) {
    return db()
      .select({ id: condos.id, name: condos.name, slug: condos.slug })
      .from(condos)
      .orderBy(asc(condos.name))
  }

  const rows = await db()
    .selectDistinct({ id: condos.id, name: condos.name, slug: condos.slug })
    .from(userCondoGrants)
    .innerJoin(condos, eq(condos.id, userCondoGrants.condoId))
    .where(
      and(
        eq(userCondoGrants.userId, userId),
        inArray(userCondoGrants.role, METER_SCOPE_ROLES as readonly MeterScopeRole[])
      )
    )
    .orderBy(asc(condos.name))

  return rows
}

/** Boolean access guard for a single condo. */
export async function userCanAccessCondo(
  userId: string,
  role: string | undefined,
  condoId: string
): Promise<boolean> {
  if (isSystemAdminRole(role)) {
    return true
  }
  const [row] = await db()
    .select({ id: userCondoGrants.id })
    .from(userCondoGrants)
    .where(
      and(
        eq(userCondoGrants.userId, userId),
        eq(userCondoGrants.condoId, condoId),
        inArray(userCondoGrants.role, METER_SCOPE_ROLES as readonly MeterScopeRole[])
      )
    )
    .limit(1)
  return Boolean(row)
}
