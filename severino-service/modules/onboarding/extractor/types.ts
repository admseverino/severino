/**
 * Output shape of an onboarding extractor. `tempKey` values are session-scoped opaque strings
 * used to link units to groups and meters to their targets _before_ rows are persisted.
 */
export type ExtractedGroupKind = 'floor' | 'tower' | 'block' | 'villa_cluster' | 'custom'

export interface ExtractedGroup {
  tempKey: string
  /** Null = root group. Max depth from root is enforced in onboarding (4 levels). */
  parentTempKey: string | null
  name: string
  kind: ExtractedGroupKind
  sortOrder: number
}

export interface ExtractedUnit {
  tempKey: string
  groupTempKey: string | null
  label: string
  sortOrder: number
}

export type ExtractedMeterTarget =
  | { kind: 'unit'; tempKey: string }
  | { kind: 'group'; tempKey: string }
  | { kind: 'condo' }

export interface ExtractedMeter {
  tempKey: string
  kind: 'submeter' | 'master'
  identifier: string | null
  target: ExtractedMeterTarget
  sortOrder: number
}

export interface ExtractedStructure {
  groups: ExtractedGroup[]
  units: ExtractedUnit[]
  meters: ExtractedMeter[]
  /** Human-readable notes ("assumed 1 submeter per unit"); shown above the preview table. */
  warnings: string[]
}

export interface OnboardingExtractor {
  extract(prompt: string): Promise<ExtractedStructure>
}
