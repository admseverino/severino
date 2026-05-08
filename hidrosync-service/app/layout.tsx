import type { Metadata, Viewport } from 'next'
import { Chivo } from 'next/font/google'
import { getServerSession } from 'next-auth'

import './globals.css'
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

  return (
    <html lang="pt-BR" suppressHydrationWarning className={`light ${chivo.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <meta name="color-scheme" content="light only" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="font-sans antialiased">
        <ClientSessionProvider session={session}>{children}</ClientSessionProvider>
      </body>
    </html>
  )
}
