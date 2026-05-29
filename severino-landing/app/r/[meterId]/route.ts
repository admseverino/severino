import { NextResponse } from 'next/server'

import { meterIdSchema } from '@/lib/validation/meters'

export const dynamic = 'force-dynamic'

/**
 * Short-link endpoint for printed QR labels (decision 4.6).
 *
 * The QR encodes `{baseUrl}/r/<meterId>`; we redirect to the canonical
 * `/reading/<meterId>` page, where scope and existence are validated. Middleware enforces auth
 * on the redirected destination — unauthenticated scans land at the login dialog with a
 * `callbackUrl` so the operator returns to the right meter after sign-in.
 */
export async function GET(
  request: Request,
  context: { params: { meterId: string } }
): Promise<Response> {
  const parsed = meterIdSchema.safeParse(context.params.meterId)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  }
  const dest = new URL(`/reading/${parsed.data}`, request.url)
  return NextResponse.redirect(dest, 307)
}
