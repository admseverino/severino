import type {
  CondoMetersBundle,
  GroupKind,
  GroupRow,
  MeterRow,
  UnitRow,
} from './repository'

export interface UnitWithMeters {
  unit: UnitRow
  submeters: MeterRow[]
}

export interface GroupNode {
  group: GroupRow
  /** Depth from root, 0-indexed. Root groups have depth 0. */
  depth: number
  children: GroupNode[]
  /** Units placed directly on this group (typically only on leaf groups). */
  directUnits: UnitWithMeters[]
}

export interface MasterEntry {
  meter: MeterRow
  /** When `targetKind` is `group`, the group it points at. */
  group: GroupRow | null
  /** When `targetKind` is `unit`, the unit it points at. */
  unit: UnitRow | null
}

export interface MetersListing {
  bundle: CondoMetersBundle
  rootGroups: GroupNode[]
  /** Units that have no `group_id` set — should be rare but we surface them so nothing is lost. */
  ungroupedUnits: UnitWithMeters[]
  masters: MasterEntry[]
  /** Total active submeters in the condo (for header stats). */
  totalSubmeters: number
}

/**
 * Build a navigable view of a condo's meters:
 *  - groups become a tree (root → children) with units placed on their leaf group;
 *  - submeters group under their unit;
 *  - masters are a flat list, decorated with their target group/unit when relevant.
 */
export function buildMetersListing(bundle: CondoMetersBundle): MetersListing {
  const submetersByUnitId = new Map<string, MeterRow[]>()
  const masters: MasterEntry[] = []
  for (const m of bundle.meters) {
    if (m.kind === 'submeter' && m.targetKind === 'unit') {
      const list = submetersByUnitId.get(m.targetId) ?? []
      list.push(m)
      submetersByUnitId.set(m.targetId, list)
      continue
    }
    if (m.kind === 'master') {
      masters.push({ meter: m, group: null, unit: null })
    }
  }

  for (const list of submetersByUnitId.values()) {
    list.sort((a, b) => (a.identifier ?? '').localeCompare(b.identifier ?? '', 'pt'))
  }

  const groupById = new Map<string, GroupRow>()
  for (const g of bundle.groups) groupById.set(g.id, g)

  const unitsByGroupId = new Map<string | null, UnitRow[]>()
  for (const u of bundle.units) {
    const key = u.groupId ?? null
    const list = unitsByGroupId.get(key) ?? []
    list.push(u)
    unitsByGroupId.set(key, list)
  }
  for (const list of unitsByGroupId.values()) {
    list.sort((a, b) => a.label.localeCompare(b.label, 'pt'))
  }

  const childrenByParentId = new Map<string | null, GroupRow[]>()
  for (const g of bundle.groups) {
    const key = g.parentGroupId ?? null
    const list = childrenByParentId.get(key) ?? []
    list.push(g)
    childrenByParentId.set(key, list)
  }
  for (const list of childrenByParentId.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  }

  function buildNode(g: GroupRow, depth: number): GroupNode {
    const directUnits = (unitsByGroupId.get(g.id) ?? []).map((u) => ({
      unit: u,
      submeters: submetersByUnitId.get(u.id) ?? [],
    }))
    const children = (childrenByParentId.get(g.id) ?? []).map((child) =>
      buildNode(child, depth + 1)
    )
    return { group: g, depth, children, directUnits }
  }

  const validIds = new Set(bundle.groups.map((g) => g.id))
  const rootRows = bundle.groups.filter(
    (g) => !g.parentGroupId || !validIds.has(g.parentGroupId)
  )
  rootRows.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  const rootGroups = rootRows.map((r) => buildNode(r, 0))

  const ungroupedUnits = (unitsByGroupId.get(null) ?? []).map((u) => ({
    unit: u,
    submeters: submetersByUnitId.get(u.id) ?? [],
  }))

  for (const m of masters) {
    if (m.meter.targetKind === 'group') {
      m.group = groupById.get(m.meter.targetId) ?? null
    } else if (m.meter.targetKind === 'unit') {
      const unit = bundle.units.find((u) => u.id === m.meter.targetId)
      if (unit) m.unit = unit
    }
  }

  masters.sort((a, b) => masterSortKey(a).localeCompare(masterSortKey(b), 'pt'))

  const totalSubmeters = bundle.meters.filter((m) => m.kind === 'submeter').length

  return { bundle, rootGroups, ungroupedUnits, masters, totalSubmeters }
}

function masterSortKey(m: MasterEntry): string {
  if (m.meter.targetKind === 'condo') return `0_${m.meter.identifier ?? m.meter.id}`
  if (m.meter.targetKind === 'group') return `1_${m.group?.name ?? m.meter.targetId}`
  return `2_${m.unit?.label ?? m.meter.targetId}`
}

export const GROUP_KINDS: readonly GroupKind[] = [
  'tower',
  'block',
  'floor',
  'villa_cluster',
  'custom',
] as const

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  tower: 'Torres',
  block: 'Blocos',
  floor: 'Andares',
  villa_cluster: 'Vilas',
  custom: 'Personalizado',
}

/**
 * The 5 possible values for the print page's "page break by" selector.
 * `none` means: render every submeter in a single flowing grid.
 */
export type PrintGroupKind = GroupKind | 'none'
export const PRINT_GROUP_KINDS: readonly PrintGroupKind[] = ['none', ...GROUP_KINDS] as const

export interface SubmeterCard {
  meter: MeterRow
  unit: UnitRow
  /** True when the meter's unit has more than one active submeter — show meter id on the label. */
  showMeterId: boolean
}

export interface PrintSection {
  /** Either a group label ("Torre A") or "Sem agrupamento" / "Outras unidades". */
  title: string
  /** Subtitle used on the print sheet to disambiguate nested groups. */
  subtitle?: string
  submeters: SubmeterCard[]
}

export interface PrintLayout {
  condo: { id: string; name: string; slug: string; logoImage: string | null }
  groupKind: PrintGroupKind
  /** Submeter sections (one printable page each when grouping ≠ `none`). */
  sections: PrintSection[]
  /** Always rendered as the final page(s). */
  masters: MasterEntry[]
}

/**
 * Build the print layout. Behaviour mirrors workflow §2:
 *  - User picks the grouping (`groupKind`); when `none`, all submeters in one flow.
 *  - When a `groupKind` is selected, we walk the group tree to find the **first ancestor** of
 *    the unit whose `kind` matches; that ancestor's name becomes the section title.
 *  - Master meters always print on their own page, labeled by their scope.
 */
export function buildPrintLayout(
  listing: MetersListing,
  groupKind: PrintGroupKind
): PrintLayout {
  const groupById = new Map<string, GroupRow>()
  for (const g of listing.bundle.groups) groupById.set(g.id, g)

  function ancestorOfKind(groupId: string | null, kind: GroupKind): GroupRow | null {
    let current = groupId ? groupById.get(groupId) ?? null : null
    while (current) {
      if (current.kind === kind) return current
      current = current.parentGroupId ? groupById.get(current.parentGroupId) ?? null : null
    }
    return null
  }

  const allUnitsWithMeters: UnitWithMeters[] = []
  function collect(node: GroupNode): void {
    for (const u of node.directUnits) allUnitsWithMeters.push(u)
    for (const c of node.children) collect(c)
  }
  for (const root of listing.rootGroups) collect(root)
  for (const u of listing.ungroupedUnits) allUnitsWithMeters.push(u)

  const cards: SubmeterCard[] = []
  for (const u of allUnitsWithMeters) {
    const showMeterId = u.submeters.length > 1
    for (const m of u.submeters) {
      cards.push({ meter: m, unit: u.unit, showMeterId })
    }
  }

  let sections: PrintSection[]
  if (groupKind === 'none') {
    sections =
      cards.length > 0
        ? [{ title: 'Submedidores', submeters: cards.slice().sort(sortCards) }]
        : []
  } else {
    const bucket = new Map<string, SubmeterCard[]>()
    const orphan: SubmeterCard[] = []
    const titleByKey = new Map<string, string>()
    for (const card of cards) {
      const ancestor = ancestorOfKind(card.unit.groupId, groupKind)
      if (!ancestor) {
        orphan.push(card)
        continue
      }
      const key = ancestor.id
      const list = bucket.get(key) ?? []
      list.push(card)
      bucket.set(key, list)
      titleByKey.set(key, ancestor.name)
    }
    const orderedKeys = [...bucket.keys()].sort((a, b) =>
      (titleByKey.get(a) ?? '').localeCompare(titleByKey.get(b) ?? '', 'pt')
    )
    sections = orderedKeys.map((key) => ({
      title: titleByKey.get(key) ?? 'Grupo',
      subtitle: GROUP_KIND_LABEL[groupKind],
      submeters: (bucket.get(key) ?? []).slice().sort(sortCards),
    }))
    if (orphan.length > 0) {
      sections.push({
        title: 'Outras unidades',
        subtitle: 'Sem grupo deste tipo',
        submeters: orphan.slice().sort(sortCards),
      })
    }
  }

  return {
    condo: listing.bundle.condo,
    groupKind,
    sections,
    masters: listing.masters,
  }
}

function sortCards(a: SubmeterCard, b: SubmeterCard): number {
  return a.unit.label.localeCompare(b.unit.label, 'pt') ||
    (a.meter.identifier ?? '').localeCompare(b.meter.identifier ?? '', 'pt')
}

/** Human label for a master meter, per workflow §2 conventions. */
export function masterPrintTitle(m: MasterEntry): string {
  if (m.meter.targetKind === 'condo') return 'Master — Hidrômetro geral'
  if (m.meter.targetKind === 'group') {
    return `Master — ${m.group?.name ?? 'Grupo'}`
  }
  return `Master — ${m.unit?.label ?? 'Unidade'}`
}
