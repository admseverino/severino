export {
  getCondoSummaryById,
  getCondoSummaryBySlug,
  getMeterWithContext,
  loadCondoMeters,
  type CondoMetersBundle,
  type CondoSummary,
  type GroupKind,
  type GroupRow,
  type LinkedMeterTargetKind,
  type MeterKind,
  type MeterRow,
  type MeterStatus,
  type MeterWithContext,
  type UnitRow,
} from './repository'

export {
  GROUP_KINDS,
  GROUP_KIND_LABEL,
  PRINT_GROUP_KINDS,
  buildMetersListing,
  buildPrintLayout,
  masterPrintTitle,
  type GroupNode,
  type MasterEntry,
  type MetersListing,
  type PrintGroupKind,
  type PrintLayout,
  type PrintSection,
  type SubmeterCard,
  type UnitWithMeters,
} from './service'

export { qrUrlFor, renderQrSvg, resolveBaseUrl } from './qr'
