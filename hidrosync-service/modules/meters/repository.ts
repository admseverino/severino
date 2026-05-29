import { and, asc, eq } from 'drizzle-orm'

import { db, schema } from '@hidrosync/db'

const { condos, condoConfig, groups, units, meters, linkedMeters } = schema

export type MeterKind = 'submeter' | 'master'
export type MeterStatus = 'active' | 'retired'
export type LinkedMeterTargetKind = 'unit' | 'group' | 'condo'
export type GroupKind = 'floor' | 'tower' | 'block' | 'villa_cluster' | 'custom'

export interface CondoSummary {
  id: string
  name: string
  slug: string
  logoImage: string | null
}

export interface GroupRow {
  id: string
  name: string
  kind: GroupKind
  parentGroupId: string | null
}

export interface UnitRow {
  id: string
  label: string
  groupId: string | null
}

export interface MeterRow {
  id: string
  kind: MeterKind
  status: MeterStatus
  identifier: string | null
  targetKind: LinkedMeterTargetKind
  targetId: string
}

export interface CondoMetersBundle {
  condo: CondoSummary
  groups: GroupRow[]
  units: UnitRow[]
  meters: MeterRow[]
}

export async function getCondoSummaryById(condoId: string): Promise<CondoSummary | null> {
  const [row] = await db()
    .select({
      id: condos.id,
      name: condos.name,
      slug: condos.slug,
      logoImage: condoConfig.logoImage,
    })
    .from(condos)
    .leftJoin(condoConfig, eq(condoConfig.condoId, condos.id))
    .where(eq(condos.id, condoId))
    .limit(1)
  return row ?? null
}

export async function getCondoSummaryBySlug(slug: string): Promise<CondoSummary | null> {
  const [row] = await db()
    .select({
      id: condos.id,
      name: condos.name,
      slug: condos.slug,
      logoImage: condoConfig.logoImage,
    })
    .from(condos)
    .leftJoin(condoConfig, eq(condoConfig.condoId, condos.id))
    .where(eq(condos.slug, slug))
    .limit(1)
  return row ?? null
}

/** Load every group, unit, and meter (with its linked target) for a condo in three small queries. */
export async function loadCondoMeters(condoId: string): Promise<CondoMetersBundle | null> {
  const condo = await getCondoSummaryById(condoId)
  if (!condo) return null

  const [groupRows, unitRows, meterRows] = await Promise.all([
    db()
      .select({
        id: groups.id,
        name: groups.name,
        kind: groups.kind,
        parentGroupId: groups.parentGroupId,
      })
      .from(groups)
      .where(eq(groups.condoId, condoId))
      .orderBy(asc(groups.name)),
    db()
      .select({ id: units.id, label: units.label, groupId: units.groupId })
      .from(units)
      .where(eq(units.condoId, condoId))
      .orderBy(asc(units.label)),
    db()
      .select({
        id: meters.id,
        kind: meters.kind,
        status: meters.status,
        identifier: meters.identifier,
        targetKind: linkedMeters.targetKind,
        targetId: linkedMeters.targetId,
      })
      .from(meters)
      .innerJoin(linkedMeters, eq(linkedMeters.meterId, meters.id))
      .where(and(eq(meters.condoId, condoId), eq(meters.status, 'active'))),
  ])

  return {
    condo,
    groups: groupRows,
    units: unitRows,
    meters: meterRows,
  }
}

export interface MeterWithContext {
  meter: {
    id: string
    kind: MeterKind
    status: MeterStatus
    identifier: string | null
    condoId: string
  }
  link: {
    targetKind: LinkedMeterTargetKind
    targetId: string
  } | null
  condo: CondoSummary
  unit: { id: string; label: string } | null
  group: { id: string; name: string; kind: GroupKind } | null
}

/** Fetch one meter with the joins needed to render `/reading/[meterId]` context. */
export async function getMeterWithContext(meterId: string): Promise<MeterWithContext | null> {
  const [base] = await db()
    .select({
      id: meters.id,
      kind: meters.kind,
      status: meters.status,
      identifier: meters.identifier,
      condoId: meters.condoId,
    })
    .from(meters)
    .where(eq(meters.id, meterId))
    .limit(1)
  if (!base) return null

  const condo = await getCondoSummaryById(base.condoId)
  if (!condo) return null

  const [link] = await db()
    .select({
      targetKind: linkedMeters.targetKind,
      targetId: linkedMeters.targetId,
    })
    .from(linkedMeters)
    .where(eq(linkedMeters.meterId, meterId))
    .limit(1)

  let unit: { id: string; label: string } | null = null
  let group: { id: string; name: string; kind: GroupKind } | null = null
  if (link?.targetKind === 'unit') {
    const [u] = await db()
      .select({ id: units.id, label: units.label, groupId: units.groupId })
      .from(units)
      .where(eq(units.id, link.targetId))
      .limit(1)
    if (u) {
      unit = { id: u.id, label: u.label }
      if (u.groupId) {
        const [g] = await db()
          .select({ id: groups.id, name: groups.name, kind: groups.kind })
          .from(groups)
          .where(eq(groups.id, u.groupId))
          .limit(1)
        if (g) group = g
      }
    }
  } else if (link?.targetKind === 'group') {
    const [g] = await db()
      .select({ id: groups.id, name: groups.name, kind: groups.kind })
      .from(groups)
      .where(eq(groups.id, link.targetId))
      .limit(1)
    if (g) group = g
  }

  return {
    meter: base,
    link: link ?? null,
    condo,
    unit,
    group,
  }
}
