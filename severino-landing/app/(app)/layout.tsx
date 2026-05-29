import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    // Prefer `middleware.ts`, which adds `callbackUrl` so users return to the page they wanted.
    // This remains as a fallback if a route is not matched by middleware.
    redirect('/?login=1')
  }

  return <main className="flex-1 container py-8">{children}</main>
}
