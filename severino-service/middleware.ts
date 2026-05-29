import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

function isPublicPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/login'
}

function bypassAuth(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/Assets')) return true
  if (pathname === '/favicon.ico') return true
  if (/\.(ico|png|jpg|jpeg|gif|svg|webp|txt|woff2?)$/i.test(pathname)) return true
  return false
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl

  if (bypassAuth(pathname)) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    const callbackPath = pathname + (search || '')
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('login', '1')
    url.searchParams.set('callbackUrl', callbackPath)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
