import type {
  ExtractedGroup,
  ExtractedMeter,
  ExtractedStructure,
  ExtractedUnit,
  OnboardingExtractor,
} from './types'

/**
 * Deterministic, regex-based extractor used while the LLM adapter is not in place yet.
 * Handles canonical Portuguese + English phrasings described in `docs/development-plan.md §M1`,
 * e.g. "10 andares, 4 apts cada, 1 master por andar + 1 master geral".
 * When both towers and floors appear, emits a **nested** tree (torre → andar → unidades).
 */

function pickFirstNumber(input: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = input.match(re)
    if (m && m[1]) {
      const n = Number.parseInt(m[1], 10)
      if (Number.isFinite(n) && n > 0) {
        return n
      }
    }
  }
  return null
}

function hasAny(input: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(input))
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

type Layout = 'floor_only' | 'tower_only' | 'nested_towers_floors' | 'custom'

interface ParsedSpec {
  layout: Layout
  /** Flat floor count or flat tower count (non-nested). */
  groupCount: number
  towerCount: number
  floorCount: number
  unitsPerGroup: number
  masterPerGroup: boolean
  condoIntake: boolean
  warnings: string[]
}

function parsePrompt(prompt: string): ParsedSpec {
  const text = prompt.toLowerCase()
  const warnings: string[] = []

  const floors = pickFirstNumber(text, [/(\d+)\s*(?:floors?|andares?|pavimentos?)/i])
  const towers = pickFirstNumber(text, [/(\d+)\s*(?:towers?|torres?|blocos?)/i])

  let layout: Layout
  let groupCount = 1
  let towerCount = 0
  let floorCount = 0

  if (floors !== null && towers !== null) {
    layout = 'nested_towers_floors'
    towerCount = towers
    floorCount = floors
    groupCount = 0
  } else if (floors !== null) {
    layout = 'floor_only'
    groupCount = floors
  } else if (towers !== null) {
    layout = 'tower_only'
    groupCount = towers
  } else {
    layout = 'custom'
    groupCount = 1
    warnings.push('Não identificamos andares/torres no texto. Usando 1 grupo genérico ("Geral").')
  }

  const perGroup = pickFirstNumber(text, [
    /(\d+)\s*(?:apts?|apartments?|apartamentos?|unidades?|units?)\s*(?:each|cada|per|por|\/)/i,
    /(\d+)\s*(?:apts?|apartments?|apartamentos?|unidades?|units?)\b/i,
  ])
  let unitsPerGroup = 0
  if (perGroup !== null) {
    unitsPerGroup = perGroup
  } else {
    warnings.push('Não identificamos a quantidade de unidades. Ajuste o texto e gere a prévia de novo.')
  }

  const masterPerGroup = hasAny(text, [
    /master\s+(?:per|por)\s+(?:floor|andar|tower|torre|pavimento|bloco)/i,
    /(?:um|1)\s+master\s+(?:per|por)\s+(?:floor|andar|tower|torre|pavimento|bloco)/i,
  ])

  const condoIntake = hasAny(text, [
    /condo\s+(?:intake|master)/i,
    /master\s+(?:do\s+)?(?:cond[oô]minio|geral|principal)/i,
    /(?:hidr[oô]metro|rel[oó]gio)\s+(?:geral|principal|do\s+cond[oô]minio)/i,
    /entrada\s+principal/i,
  ])

  return {
    layout,
    groupCount,
    towerCount,
    floorCount,
    unitsPerGroup,
    masterPerGroup,
    condoIntake,
    warnings,
  }
}

function groupNameFlat(layout: Layout, idx: number): string {
  if (layout === 'floor_only') return `Andar ${idx}`
  if (layout === 'tower_only') return `Torre ${String.fromCharCode(64 + idx)}`
  return 'Geral'
}

function unitLabelFlat(layout: Layout, groupIdx: number, unitIdx: number): string {
  if (layout === 'floor_only') {
    return `${groupIdx}${pad2(unitIdx)}`
  }
  if (layout === 'tower_only') {
    return `${String.fromCharCode(64 + groupIdx)}-${pad2(unitIdx)}`
  }
  return `U${pad2(unitIdx)}`
}

function buildNestedTowerFloors(spec: ParsedSpec): ExtractedStructure {
  const groups: ExtractedGroup[] = []
  const units: ExtractedUnit[] = []
  const meters: ExtractedMeter[] = []
  const warnings = [...spec.warnings]

  let sortOrder = 0
  let unitOrder = 0
  let meterOrder = 0

  for (let t = 1; t <= spec.towerCount; t += 1) {
    const towerKey = `g_t_${t}`
    sortOrder += 1
    groups.push({
      tempKey: towerKey,
      parentTempKey: null,
      name: `Torre ${String.fromCharCode(64 + t)}`,
      kind: 'tower',
      sortOrder,
    })

    for (let f = 1; f <= spec.floorCount; f += 1) {
      const floorKey = `g_t_${t}_f_${f}`
      sortOrder += 1
      groups.push({
        tempKey: floorKey,
        parentTempKey: towerKey,
        name: `Andar ${f}`,
        kind: 'floor',
        sortOrder,
      })

      for (let u = 1; u <= spec.unitsPerGroup; u += 1) {
        const unitTempKey = `u_t${t}_f${f}_u${u}`
        const label = `${String.fromCharCode(64 + t)}${pad2(f)}${pad2(u)}`
        units.push({
          tempKey: unitTempKey,
          groupTempKey: floorKey,
          label,
          sortOrder: ++unitOrder,
        })
        meters.push({
          tempKey: `m_sub_${unitTempKey}`,
          kind: 'submeter',
          identifier: null,
          target: { kind: 'unit', tempKey: unitTempKey },
          sortOrder: ++meterOrder,
        })
      }

      if (spec.masterPerGroup) {
        meters.push({
          tempKey: `m_master_${floorKey}`,
          kind: 'master',
          identifier: null,
          target: { kind: 'group', tempKey: floorKey },
          sortOrder: ++meterOrder,
        })
      }
    }
  }

  if (spec.condoIntake) {
    meters.push({
      tempKey: 'm_master_condo',
      kind: 'master',
      identifier: null,
      target: { kind: 'condo' },
      sortOrder: ++meterOrder,
    })
  }

  if (units.length === 0) {
    warnings.push('Nenhuma unidade foi gerada. Verifique o texto e tente novamente.')
  }
  if (!spec.masterPerGroup && !spec.condoIntake) {
    warnings.push(
      'Nenhum master meter detectado. Você pode adicionar masters depois em "Medidores" (Meter Lifecycle §).'
    )
  }

  return { groups, units, meters, warnings }
}

function buildFlatStructure(spec: ParsedSpec): ExtractedStructure {
  const groups: ExtractedGroup[] = []
  const units: ExtractedUnit[] = []
  const meters: ExtractedMeter[] = []
  const warnings = [...spec.warnings]

  const drizzleKind: ExtractedGroup['kind'] =
    spec.layout === 'floor_only' ? 'floor' : spec.layout === 'tower_only' ? 'tower' : 'custom'

  let unitOrder = 0
  let meterOrder = 0

  for (let g = 1; g <= spec.groupCount; g += 1) {
    const groupTempKey = `g_${g}`
    groups.push({
      tempKey: groupTempKey,
      parentTempKey: null,
      name: groupNameFlat(spec.layout, g),
      kind: drizzleKind,
      sortOrder: g,
    })

    for (let u = 1; u <= spec.unitsPerGroup; u += 1) {
      const unitTempKey = `u_${g}_${u}`
      const label = unitLabelFlat(spec.layout, g, u)
      units.push({
        tempKey: unitTempKey,
        groupTempKey,
        label,
        sortOrder: ++unitOrder,
      })
      meters.push({
        tempKey: `m_sub_${g}_${u}`,
        kind: 'submeter',
        identifier: null,
        target: { kind: 'unit', tempKey: unitTempKey },
        sortOrder: ++meterOrder,
      })
    }

    if (spec.masterPerGroup) {
      meters.push({
        tempKey: `m_master_grp_${g}`,
        kind: 'master',
        identifier: null,
        target: { kind: 'group', tempKey: groupTempKey },
        sortOrder: ++meterOrder,
      })
    }
  }

  if (spec.condoIntake) {
    meters.push({
      tempKey: 'm_master_condo',
      kind: 'master',
      identifier: null,
      target: { kind: 'condo' },
      sortOrder: ++meterOrder,
    })
  }

  if (units.length === 0) {
    warnings.push('Nenhuma unidade foi gerada. Verifique o texto e tente novamente.')
  }
  if (!spec.masterPerGroup && !spec.condoIntake) {
    warnings.push(
      'Nenhum master meter detectado. Você pode adicionar masters depois em "Medidores" (Meter Lifecycle §).'
    )
  }

  return { groups, units, meters, warnings }
}

function buildStructure(spec: ParsedSpec): ExtractedStructure {
  if (spec.layout === 'nested_towers_floors') {
    return buildNestedTowerFloors(spec)
  }
  return buildFlatStructure(spec)
}

export class MockOnboardingExtractor implements OnboardingExtractor {
  extract(prompt: string): Promise<ExtractedStructure> {
    const spec = parsePrompt(prompt)
    return Promise.resolve(buildStructure(spec))
  }
}
