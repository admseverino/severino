import { redirect } from 'next/navigation'

/**
 * `/login` is now a popup hosted on the marketing home; this page only forwards.
 * NextAuth still uses `pages.signIn = "/login"`, so we keep the URL alive but forward
 * to `/?login=1` (with `callbackUrl` preserved) so the dialog opens automatically.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}): never {
  const raw = searchParams.callbackUrl ?? searchParams.returnUrl
  const callbackUrl = Array.isArray(raw) ? raw[0] : raw
  const params = new URLSearchParams({ login: '1' })
  if (typeof callbackUrl === 'string' && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) {
    params.set('callbackUrl', callbackUrl)
  }
  redirect(`/?${params.toString()}`)
}
