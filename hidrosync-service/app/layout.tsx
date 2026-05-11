import type { Metadata, Viewport } from 'next'
import { Chivo } from 'next/font/google'
import { getServerSession } from 'next-auth'

import './globals.css'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { NavigationMenu } from '@/components/layout/NavigationMenu'
import { authOptions } from '@/lib/auth'
import { ClientSessionProvider } from '@/components/providers/session-provider'

const chivo = Chivo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-chivo',
})

export const metadata: Metadata = {
  title: 'HidroSync',
  description: 'Leitura inteligente de hidrômetros para condomínios',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions)
  const showGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`light ${chivo.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <meta name="color-scheme" content="light only" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="font-sans antialiased">
        <ClientSessionProvider session={session}>
          <div className="min-h-screen bg-background flex flex-col">
            <Header showGoogle={showGoogle} />
            <NavigationMenu />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </ClientSessionProvider>
      </body>
    </html>
  )
}
