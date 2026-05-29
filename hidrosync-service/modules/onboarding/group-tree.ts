import type { ExtractedGroup } from './extractor/types'

/** Root depth = 1; deepest allowed node has depth 4 (max 3 parent links below root). */
export const MAX_GROUP_DEPTH = 4

export interface GroupTreeNode {
  tempKey: string
  parentTempKey: string | null
}

/**
 * Walks parent links upward until null. Returns depth where root = 1.
 * Returns `null` if a cycle is detected.
 */
export function depthFromRoot(
  nodeKey: string,
  byKey: Map<string, Pick<ExtractedGroup, 'parentTempKey'>>,
  visiting: Set<string> = new Set()
): number | null {
  if (visiting.has(nodeKey)) return null
  visiting.add(nodeKey)
  const node = byKey.get(nodeKey)
  if (!node) {
    visiting.delete(nodeKey)
    return 1
  }
  if (!node.parentTempKey) {
    visiting.delete(nodeKey)
    return 1
  }
  const parentDepth = depthFromRoot(node.parentTempKey, byKey, visiting)
  visiting.delete(nodeKey)
  if (parentDepth === null) return null
  return parentDepth + 1
}

/** Validates parent refs, acyclicity, and max depth. Throws with joined PT messages on failure. */
export function assertValidGroupStructure(groups: ExtractedGroup[]): void {
  if (groups.length === 0) return
  const byKey = new Map(groups.map((g) => [g.tempKey, g]))
  const errors: string[] = []

  for (const g of groups) {
    if (g.parentTempKey) {
      if (!byKey.has(g.parentTempKey)) {
        errors.push(`Grupo "${g.name}" (${g.tempKey}): pai "${g.parentTempKey}" inexistente.`)
      }
      if (g.parentTempKey === g.tempKey) {
        errors.push(`Grupo "${g.name}": não pode ser pai de si mesmo.`)
      }
    }
  }

  for (const g of groups) {
    const d = depthFromRoot(g.tempKey, byKey, new Set())
    if (d === null) {
      errors.push(`Ciclo detectado na hierarquia de grupos (envolvendo "${g.name}" / ${g.tempKey}).`)
      break
    }
    if (d > MAX_GROUP_DEPTH) {
      errors.push(
        `Grupo "${g.name}" fica além da profundidade máxima permitida (${MAX_GROUP_DEPTH} níveis a partir da raiz).`
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }
}

/**
 * Shortens overly deep branches so every node is at most `MAX_GROUP_DEPTH` from the root.
 * Mutates a cloned list; appends a warning when any change was made.
 */
export function clampGroupsToMaxDepth(groups: ExtractedGroup[], warnings: string[]): ExtractedGroup[] {
  if (groups.length === 0) return groups
  const clones = groups.map((g) => ({ ...g }))
  const byKey = (): Map<string, ExtractedGroup> => new Map(clones.map((g) => [g.tempKey, g]))

  function depthOf(k: string, b: Map<string, ExtractedGroup>): number {
    let d = 0
    let cur: string | null = k
    const vis = new Set<string>()
    while (cur) {
      if (vis.has(cur)) return 999
      vis.add(cur)
      d++
      const n = b.get(cur)
      cur = n?.parentTempKey ?? null
    }
    return d
  }

  let anyClamp = false
  for (let iter = 0; iter < clones.length * 3; iter++) {
    const b = byKey()
    let worst = 0
    let bad: ExtractedGroup | null = null
    for (const g of clones) {
      const d = depthOf(g.tempKey, b)
      if (d > MAX_GROUP_DEPTH && d > worst) {
        worst = d
        bad = g
      }
    }
    if (!bad) break
    anyClamp = true
    const steps = worst - MAX_GROUP_DEPTH
    let cur: string | null = bad.tempKey
    for (let i = 0; i < steps && cur; i++) {
      cur = b.get(cur)?.parentTempKey ?? null
    }
    bad.parentTempKey = cur ? b.get(cur)?.parentTempKey ?? null : null
  }

  if (anyClamp) {
    warnings.push(
      `A hierarquia de grupos excedeu ${MAX_GROUP_DEPTH} níveis a partir da raiz; alguns nós foram reanexados para caber no limite.`
    )
  }
  return clones
}

/**
 * Parents before children; ties broken by `sortOrder` then `tempKey` for stability.
 */
/** BFS from roots; children sorted by `sortOrder`. Throws if tree is disconnected or cyclic. */
export function sortTempGroupRowsForCommit<
  T extends { id: string; parentTempGroupId: string | null; sortOrder: number },
>(rows: T[]): T[] {
  if (rows.length === 0) return []
  const childrenOf = new Map<string | null, T[]>()
  for (const r of rows) {
    const p = r.parentTempGroupId
    const arr = childrenOf.get(p) ?? []
    arr.push(r)
    childrenOf.set(p, arr)
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  }
  const queue = [...(childrenOf.get(null) ?? [])]
  const out: T[] = []
  while (queue.length) {
    const r = queue.shift()!
    out.push(r)
    const kids = childrenOf.get(r.id) ?? []
    queue.push(...kids)
  }
  if (out.length !== rows.length) {
    throw new Error('Hierarquia de grupos inválida (ciclo ou pai órfão).')
  }
  return out
}

export function sortGroupsForInsert(groups: ExtractedGroup[]): ExtractedGroup[] {
  if (groups.length === 0) return []
  const byKey = new Map(groups.map((g) => [g.tempKey, g]))
  const depthMemo = new Map<string, number>()

  function depthOf(key: string): number {
    const cached = depthMemo.get(key)
    if (cached !== undefined) return cached
    const g = byKey.get(key)
    if (!g) {
      depthMemo.set(key, 1)
      return 1
    }
    if (!g.parentTempKey) {
      depthMemo.set(key, 1)
      return 1
    }
    const d = 1 + depthOf(g.parentTempKey)
    depthMemo.set(key, d)
    return d
  }

  return [...groups].sort((a, b) => {
    const da = depthOf(a.tempKey)
    const db = depthOf(b.tempKey)
    if (da !== db) return da - db
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.tempKey.localeCompare(b.tempKey)
  })
}
