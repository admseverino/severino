import { QrSvg } from './QrSvg'

export interface QrLabelProps {
  /** Pre-rendered QR SVG markup. */
  qrSvg: string
  /** The URL the QR encodes — surfaced as the accessible label. */
  qrUrl: string
  condoName: string
  condoLogoUrl?: string | null
  /** Big heading on the label (unit string for submeters; master scope label for masters). */
  title: string
  /** Optional secondary line (e.g. group name, master target details). */
  subtitle?: string | null
  /** Meter identifier line — only shown when the parent requests it (multiple meters per unit, or any master). */
  meterIdLine?: string | null
}

/**
 * A single printable QR label. Layout mirrors workflow §2: logo (top), condo name, unit/master
 * line, the QR itself, and optional meter id at the bottom for disambiguation.
 *
 * Sized to fit a 3-column print grid on A4. Uses `print:` Tailwind utilities so the same JSX
 * looks reasonable on screen and prints cleanly.
 */
export function QrLabel({
  qrSvg,
  qrUrl,
  condoName,
  condoLogoUrl,
  title,
  subtitle,
  meterIdLine,
}: QrLabelProps): React.JSX.Element {
  return (
    <article
      data-testid="qr-label"
      className="flex break-inside-avoid flex-col items-center gap-1.5 rounded-[4px] border border-hidrostone/40 bg-white p-2 text-center text-hidrostone print:border-black print:bg-white print:text-black"
    >
      <header className="flex w-full items-center justify-center gap-2">
        {condoLogoUrl ? (
          <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-white">
            {/* Plain <img>: logos sit inside a print sheet, where next/image's optimizations and
                blur placeholders are pure overhead and break print fidelity. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={condoLogoUrl} alt="" className="max-h-6 max-w-6 object-contain" />
          </span>
        ) : null}
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide">
          {condoName}
        </p>
      </header>
      <h3
        className="text-sm font-extrabold uppercase leading-tight"
        data-testid="qr-label-title"
      >
        {title}
      </h3>
      {subtitle ? (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground print:text-black">
          {subtitle}
        </p>
      ) : null}
      <QrSvg svg={qrSvg} alt={qrUrl} className="h-28 w-28 print:h-24 print:w-24" />
      {meterIdLine ? (
        <p
          className="font-mono text-[10px] uppercase tracking-tight text-muted-foreground print:text-black"
          data-testid="qr-label-meter-id"
        >
          {meterIdLine}
        </p>
      ) : null}
    </article>
  )
}
