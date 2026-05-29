'use client'

import type { Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'

interface ClientSessionProviderProps {
  children: React.ReactNode
  session: Session | null
}

export function ClientSessionProvider({ children, session }: ClientSessionProviderProps): React.JSX.Element {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false} refetchInterval={5 * 60}>
      {children}
    </SessionProvider>
  )
}
