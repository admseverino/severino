import { and, eq } from 'drizzle-orm'

import { db, schema } from '@severino/db'

import { writeAudit } from '@/modules/audit/log'

import { sortTempGroupRowsForCommit } from './group-tree'
import type { OnboardingSessionRow } from './repository'

const {
  condos,
  condoConfig,
  groups,
  units,
  meters,
  linkedMeters,
  userCondoGrants,
  onboardingSessions,
  tempGroups,
  tempUnits,
  tempMeters,
} = schema

export interface CommitInput {
  actorId: string
  session: OnboardingSessionRow
}

export interface CommitResult {
  condoId: string
  condoSlug: string
  counts: {
    groups: number
    units: number
    submeters: number
    masters: number
  }
}

/**
 * Commit a draft onboarding session: temp rows → permanent rows in a single transaction.
 * Idempotency is handled at the call-site (we refuse to commit a session twice).
 */
export async function commitOnboardingSession(input: CommitInput): Promise<CommitResult> {
  const { actorId, session } = input

  if (session.status !== 'draft') {
    throw new Error('Sessão de onboarding já comprometida')
  }

  const result = await db().transaction(async (tx) => {
    const [condoRow] = await tx
      .insert(condos)
      .values({ name: session.condoName, slug: session.condoSlug })
      .returning()
    if (!condoRow) throw new Error('Failed to insert condo')

    await tx.insert(condoConfig).values({
      condoId: condoRow.id,
      logoImage: session.logoImage ?? null,
    })

    const tempGroupRows = await tx.select().from(tempGroups).where(eq(tempGroups.sessionId, session.id))
    const tempUnitRows = await tx.select().from(tempUnits).where(eq(tempUnits.sessionId, session.id))
    const tempMeterRows = await tx.select().from(tempMeters).where(eq(tempMeters.sessionId, session.id))

    const groupIdByTemp = new Map<string, string>()
    if (tempGroupRows.length > 0) {
      const ordered = sortTempGroupRowsForCommit(tempGroupRows)
      for (const g of ordered) {
        const [inserted] = await tx
          .insert(groups)
          .values({
            condoId: condoRow.id,
            name: g.name,
            kind: g.kind,
            parentGroupId: g.parentTempGroupId ? (groupIdByTemp.get(g.parentTempGroupId) ?? null) : null,
          })
          .returning({ id: groups.id })
        if (!inserted) throw new Error('Failed to insert group')
        groupIdByTemp.set(g.id, inserted.id)
      }
    }

    const unitIdByTemp = new Map<string, string>()
    if (tempUnitRows.length > 0) {
      const sorted = [...tempUnitRows].sort((a, b) => a.sortOrder - b.sortOrder)
      const insertedUnits = await tx
        .insert(units)
        .values(
          sorted.map((u) => ({
            condoId: condoRow.id,
            groupId: u.tempGroupId ? (groupIdByTemp.get(u.tempGroupId) ?? null) : null,
            label: u.label,
          }))
        )
        .returning({ id: units.id, label: units.label })
      const idByLabel = new Map(insertedUnits.map((row) => [row.label, row.id]))
      for (const u of sorted) {
        const id = idByLabel.get(u.label)
        if (id) unitIdByTemp.set(u.id, id)
      }
    }

    let submeterCount = 0
    let masterCount = 0
    if (tempMeterRows.length > 0) {
      const sorted = [...tempMeterRows].sort((a, b) => a.sortOrder - b.sortOrder)
      for (const m of sorted) {
        const [meterRow] = await tx
          .insert(meters)
          .values({
            condoId: condoRow.id,
            kind: m.kind,
            identifier: m.identifier,
          })
          .returning({ id: meters.id })
        if (!meterRow) throw new Error('Failed to insert meter')

        let targetId: string | null = null
        if (m.targetKind === 'unit' && m.targetTempUnitId) {
          targetId = unitIdByTemp.get(m.targetTempUnitId) ?? null
        } else if (m.targetKind === 'group' && m.targetTempGroupId) {
          targetId = groupIdByTemp.get(m.targetTempGroupId) ?? null
        } else if (m.targetKind === 'condo') {
          targetId = condoRow.id
        }

        if (!targetId) {
          throw new Error(`Linked meter target missing for temp meter ${m.id}`)
        }

        await tx.insert(linkedMeters).values({
          meterId: meterRow.id,
          targetKind: m.targetKind,
          targetId,
        })

        if (m.kind === 'submeter') submeterCount += 1
        else masterCount += 1
      }
    }

    // Grant condo_admin to the actor so they can immediately manage the new condo.
    await tx
      .insert(userCondoGrants)
      .values({ userId: actorId, condoId: condoRow.id, role: 'condo_admin' })
      .onConflictDoNothing()

    await tx
      .update(onboardingSessions)
      .set({ status: 'committed', committedCondoId: condoRow.id, updatedAt: new Date() })
      .where(and(eq(onboardingSessions.id, session.id), eq(onboardingSessions.actorId, actorId)))

    return {
      condoId: condoRow.id,
      condoSlug: condoRow.slug,
      counts: {
        groups: groupIdByTemp.size,
        units: unitIdByTemp.size,
        submeters: submeterCount,
        masters: masterCount,
      },
    }
  })

  await writeAudit({
    actor: actorId,
    entity: 'condo',
    entityId: result.condoId,
    action: 'condo.onboarded',
    before: null,
    after: {
      sessionId: session.id,
      condoName: session.condoName,
      condoSlug: session.condoSlug,
      counts: result.counts,
    },
    reason: 'M1 onboarding commit',
  })

  return result
}
