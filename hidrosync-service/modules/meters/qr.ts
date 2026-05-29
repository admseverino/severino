import QRCode from 'qrcode'

/**
 * Resolve the public base URL used in printed QR codes. We prefer the explicit
 * `NEXTAUTH_URL` (already required by NextAuth and provided per environment); when running on
 * Cloud Run without it, fall back to a same-origin URL derived from the incoming request.
 */
export function resolveBaseUrl(requestUrl?: string | null): string {
  const fromEnv = process.env.NEXTAUTH_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (requestUrl) {
    try {
      const u = new URL(requestUrl)
      return `${u.protocol}//${u.host}`
    } catch {
      // fall through
    }
  }
  return 'http://localhost:3000'
}

/** The exact URL encoded into the printed QR for a given meter (decision 4.6). */
export function qrUrlFor(meterId: string, baseUrl: string): string {
  return `${baseUrl}/r/${encodeURIComponent(meterId)}`
}

const SVG_CACHE = new Map<string, string>()

/**
 * Render an SVG QR for an arbitrary URL. Cached per URL within the process to keep the print
 * sheet snappy even with many labels. `qrcode` produces deterministic output for a given input,
 * so the cache is safe.
 */
export async function renderQrSvg(url: string): Promise<string> {
  const cached = SVG_CACHE.get(url)
  if (cached) return cached
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
  })
  SVG_CACHE.set(url, svg)
  return svg
}
