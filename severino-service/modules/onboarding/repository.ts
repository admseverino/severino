import { and, asc, eq } from 'drizzle-orm'

import { db, schema } from '@severino/db'

import type { ExtractedStructure } from './extractor'
import { sortGroupsForInsert } from './group-tree'

const { onboardingSessions, tempGroups, tempUnits, tempMeters } = schema

export type OnboardingSessionRow = typeof onboardingSessions.$inferSelect
export type TempGroupRow = typeof tempGroups.$inferSelect
export type TempUnitRow = typeof tempUnits.$inferSelect
export type TempMeterRow = typeof tempMeters.$inferSelect

export interface OnboardingDraftInput {
  actorId: string
  condoName: string
  condoSlug: string
  prompt: string
  logoImage?: string | null
}

export async function createDraftSession(input: OnboardingDraftInput): Promise<OnboardingSessionRow> {
  const [row] = await db()
    .insert(onboardingSessions)
    .values({
      actorId: input.actorId,
      condoName: input.condoName,
      condoSlug: input.condoSlug,
      prompt: input.prompt,
      logoImage: input.logoImage ?? null,
    })
    .returning()
  if (!row) throw new Error('Failed to create onboarding session')
  return row
}

export async function updateDraftSession(
  sessionId: string,
  patch: Partial<OnboardingDraftInput>
): Promise<OnboardingSessionRow | null> {
  const [row] = await db()
    .update(onboardingSessions)
    .set({
      ...(patch.condoName !== undefined ? { condoName: patch.condoName } : {}),
      ...(patch.condoSlug !== undefined ? { condoSlug: patch.condoSlug } : {}),
      ...(patch.prompt !== undefined ? { prompt: patch.prompt } : {}),
      ...(patch.logoImage !== undefined ? { logoImage: patch.logoImage } : {}),
      updatedAt: new Date(),
    })
    .where(eq(onboardingSessions.id, sessionId))
    .returning()
  return row ?? null
}

export async function findDraftSessionForActor(
  sessionId: string,
  actorId: string
): Promise<OnboardingSessionRow | null> {
  const [row] = await db()
    .select()
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.id, sessionId), eq(onboardingSessions.actorId, actorId)))
    .limit(1)
  return row ?? null
}

/**
 * Re-running the prompt fully regenerates temp rows. We delete groups (cascade clears units and
 * meters via ON DELETE CASCADE) and meters-without-target-group (condo-scoped). One transaction.
 */
export async function replaceTempStructure(
  sessionId: string,
  structure: ExtractedStructure
): Promise<{ groupIdByTempKey: Map<string, string>; unitIdByTempKey: Map<string, string> }> {
  return db().transaction(async (tx) => {
    await tx.delete(tempMeters).where(eq(tempMeters.sessionId, sessionId))
    await tx.delete(tempUnits).where(eq(tempUnits.sessionId, sessionId))
    await tx.delete(tempGroups).where(eq(tempGroups.sessionId, sessionId))

    const groupIdByTempKey = new Map<string, string>()
    if (structure.groups.length > 0) {
      const ordered = sortGroupsForInsert(structure.groups)
      for (const g of ordered) {
        const [row] = await tx
          .insert(tempGroups)
          .values({
            sessionId,
            name: g.name,
            kind: g.kind,
            sortOrder: g.sortOrder,
            parentTempGroupId: g.parentTempKey ? (groupIdByTempKey.get(g.parentTempKey) ?? null) : null,
          })
          .returning({ id: tempGroups.id })
        if (!row) throw new Error('Failed to insert temp group')
        groupIdByTempKey.set(g.tempKey, row.id)
      }
    }

    const unitIdByTempKey = new Map<string, string>()
    if (structure.units.length > 0) {
      const insertedUnits = await tx
        .insert(tempUnits)
        .values(
          structure.units.map((u) => ({
            sessionId,
            tempGroupId: u.groupTempKey ? (groupIdByTempKey.get(u.groupTempKey) ?? null) : null,
            label: u.label,
            sortOrder: u.sortOrder,
          }))
        )
        .returning({ id: tempUnits.id, label: tempUnits.label })

      const idByLabel = new Map(insertedUnits.map((row) => [row.label, row.id]))
      for (const u of structure.units) {
        const id = idByLabel.get(u.label)
        if (id) unitIdByTempKey.set(u.tempKey, id)
      }
    }

    if (structure.meters.length > 0) {
      await tx.insert(tempMeters).values(
        structure.meters.map((m) => {
          if (m.target.kind === 'unit') {
            return {
              sessionId,
              kind: m.kind,
              identifier: m.identifier,
              targetKind: 'unit' as const,
              targetTempUnitId: unitIdByTempKey.get(m.target.tempKey) ?? null,
              targetTempGroupId: null,
              sortOrder: m.sortOrder,
            }
          }
          if (m.target.kind === 'group') {
            return {
              sessionId,
              kind: m.kind,
              identifier: m.identifier,
              targetKind: 'group' as const,
              targetTempUnitId: null,
              targetTempGroupId: groupIdByTempKey.get(m.target.tempKey) ?? null,
              sortOrder: m.sortOrder,
            }
          }
          return {
            sessionId,
            kind: m.kind,
            identifier: m.identifier,
            targetKind: 'condo' as const,
            targetTempUnitId: null,
            targetTempGroupId: null,
            sortOrder: m.sortOrder,
          }
        })
      )
    }

    return { groupIdByTempKey, unitIdByTempKey }
  })
}

export interface OnboardingPreview {
  session: OnboardingSessionRow
  groups: TempGroupRow[]
  units: TempUnitRow[]
  meters: TempMeterRow[]
}

export async function loadPreview(sessionId: string): Promise<Omit<OnboardingPreview, 'session'>> {
  const [groups, units, meters] = await Promise.all([
    db()
      .select()
      .from(tempGroups)
      .where(eq(tempGroups.sessionId, sessionId))
      .orderBy(asc(tempGroups.sortOrder)),
    db()
      .select()
      .from(tempUnits)
      .where(eq(tempUnits.sessionId, sessionId))
      .orderBy(asc(tempUnits.sortOrder)),
    db()
      .select()
      .from(tempMeters)
      .where(eq(tempMeters.sessionId, sessionId))
      .orderBy(asc(tempMeters.sortOrder)),
  ])
  return { groups, units, meters }
}

export async function markSessionCommitted(
  sessionId: string,
  condoId: string
): Promise<void> {
  await db()
    .update(onboardingSessions)
    .set({ status: 'committed', committedCondoId: condoId, updatedAt: new Date() })
    .where(eq(onboardingSessions.id, sessionId))
}
