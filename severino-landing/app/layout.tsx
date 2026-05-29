import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { getServerSession } from 'next-auth'

import './globals.css'
import { AppChrome } from '@/components/layout/AppChrome'
import { authOptions } from '@/lib/auth'
import { ClientSessionProvider } from '@/components/providers/session-provider'

const googleSansFlex = localFont({
  src: './fonts/google-sans-flex-latin.woff2',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Severino',
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
    <html lang="pt-BR" suppressHydrationWarning className={`light ${googleSansFlex.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <meta name="color-scheme" content="light only" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="font-sans antialiased">
        <ClientSessionProvider session={session}>
          <AppChrome showGoogle={showGoogle}>{children}</AppChrome>
        </ClientSessionProvider>
      </body>
    </html>
  )
}
