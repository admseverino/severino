import { cn } from '@/lib/utils'

interface QrSvgProps {
  /** Raw SVG markup produced by `renderQrSvg`. */
  svg: string
  /** Accessible label for screen readers and crawlers. */
  alt: string
  className?: string
}

/**
 * Inline server-generated QR SVG. Trusted: the SVG is produced by `qrcode` on the server with
 * no user-controlled markup, only the URL embedded as path geometry.
 *
 * The `qrcode` lib bakes `width`/`height` attributes into its SVG output (200×200 here), which
 * override any CSS on the parent. We use `[&>svg]:h-full [&>svg]:w-full` to force the inner
 * SVG to follow the container size set by `className` (e.g. `h-28 w-28`).
 */
export function QrSvg({ svg, alt, className }: QrSvgProps): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={alt}
      data-testid="qr-svg"
      className={cn(
        'inline-block [&>svg]:block [&>svg]:h-full [&>svg]:w-full',
        className
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
