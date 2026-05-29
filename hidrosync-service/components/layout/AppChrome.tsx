'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { AuthDialog } from '@/components/auth/AuthDialog'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AuthLoginProvider } from '@/components/layout/auth-login-context'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { TooltipProvider } from '@/components/ui/tooltip'

function safeInternalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

function pathAfterAuthFromLocation(pathname: string, searchParams: URLSearchParams): string {
  const p = new URLSearchParams(searchParams.toString())
  p.delete('login')
  p.delete('callbackUrl')
  const qs = p.toString()
  return pathname + (qs ? `?${qs}` : '')
}

function SearchParamsAuthSync({
  session,
  onOpenLogin,
}: {
  session: ReturnType<typeof useSession>['data']
  onOpenLogin: () => void
}): null {
  const searchParams = useSearchParams()
  const loginFlag = searchParams.get('login')

  useEffect(() => {
    if (loginFlag === '1' && !session?.user) {
      onOpenLogin()
    }
  }, [loginFlag, session?.user, onOpenLogin])

  return null
}

function AuthDialogWithRedirect({
  open,
  onOpenChange,
  showGoogle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  showGoogle: boolean
}): React.JSX.Element {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const redirectAfterLogin = useMemo(() => {
    const fromQuery = searchParams.get('callbackUrl')
    const stayHere = pathAfterAuthFromLocation(pathname, searchParams)
    if (fromQuery) {
      return safeInternalPath(fromQuery, stayHere)
    }
    return safeInternalPath(stayHere, '/')
  }, [searchParams, pathname])

  const stripLoginQuery = useCallback((): void => {
    const next = new URLSearchParams(searchParams.toString())
    let changed = false
    if (next.has('login')) {
      next.delete('login')
      changed = true
    }
    if (next.has('callbackUrl')) {
      next.delete('callbackUrl')
      changed = true
    }
    if (!changed) return
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const handleAuthDialogChange = (next: boolean): void => {
    onOpenChange(next)
    if (!next) {
      stripLoginQuery()
    }
  }

  return (
    <AuthDialog
      open={open}
      onOpenChange={handleAuthDialogChange}
      redirectAfterLogin={redirectAfterLogin}
      showGoogle={showGoogle}
    />
  )
}

export function AppChrome({
  children,
  showGoogle,
}: {
  children: React.ReactNode
  showGoogle: boolean
}): React.JSX.Element {
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const openLogin = useCallback(() => setAuthDialogOpen(true), [])
  const { data: session } = useSession()
  const authLoginValue = useMemo(() => ({ openLogin }), [openLogin])

  return (
    <AuthLoginProvider value={authLoginValue}>
      <TooltipProvider delayDuration={300}>
        <div className="flex min-h-screen flex-col bg-background">
          <Header showGoogle={showGoogle} />
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-1 md:items-stretch">
            <AppSidebar />
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="min-h-0 flex-1 overflow-auto pb-16 md:pb-14">{children}</div>
            </div>
          </div>
          <Footer fixed />
        </div>
        <Suspense fallback={null}>
          <SearchParamsAuthSync session={session} onOpenLogin={openLogin} />
        </Suspense>
        <Suspense fallback={null}>
          <AuthDialogWithRedirect open={authDialogOpen} onOpenChange={setAuthDialogOpen} showGoogle={showGoogle} />
        </Suspense>
      </TooltipProvider>
    </AuthLoginProvider>
  )
}
