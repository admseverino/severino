'use client'

import { createContext, useContext } from 'react'

export interface AuthLoginContextValue {
  openLogin: () => void
}

const AuthLoginContext = createContext<AuthLoginContextValue | null>(null)

export function AuthLoginProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: AuthLoginContextValue
}): React.JSX.Element {
  return <AuthLoginContext.Provider value={value}>{children}</AuthLoginContext.Provider>
}

export function useAuthLogin(): AuthLoginContextValue {
  const ctx = useContext(AuthLoginContext)
  if (!ctx) {
    throw new Error('useAuthLogin must be used within AuthLoginProvider')
  }
  return ctx
}
