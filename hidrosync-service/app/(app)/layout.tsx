import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { NavigationMenu } from '@/components/layout/NavigationMenu'

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

  const showGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header showGoogle={showGoogle} />
      <NavigationMenu />
      <main className="flex-1 container py-8">{children}</main>
      <Footer />
    </div>
  )
}
