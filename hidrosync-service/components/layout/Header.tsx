'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Menu } from 'lucide-react'

import { AuthDialog } from '@/components/auth/AuthDialog'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const menuItems = [
  { label: 'HOME', href: '/' },
  { label: 'MEDIDORES', href: '/meters' },
  { label: 'LEITURAS', href: '/reading' },
  { label: 'CONSUMO', href: '/consumption' },
  { label: 'PAGAMENTOS', href: '/billing' },
  { label: 'CONFIGURAÇÕES', href: '/account' },
] as const

interface HeaderProps {
  /** When false, mobile sheet uses only marketing links (no app nav). */
  showFullNav?: boolean
  /** Server-resolved: only true when GOOGLE_CLIENT_ID/SECRET are configured. */
  showGoogle: boolean
}

function safeInternalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

/** Same-origin return path after auth: strip dialog query params only. */
function pathAfterAuthFromLocation(pathname: string, searchParams: URLSearchParams): string {
  const p = new URLSearchParams(searchParams.toString())
  p.delete('login')
  p.delete('callbackUrl')
  const qs = p.toString()
  return pathname + (qs ? `?${qs}` : '')
}

export function Header({ showFullNav = true, showGoogle }: HeaderProps): React.JSX.Element {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)

  const mobileLinks = showFullNav ? menuItems : [{ label: 'HOME', href: '/' }]

  const redirectAfterLogin = useMemo(() => {
    const fromQuery = searchParams.get('callbackUrl')
    const stayHere = pathAfterAuthFromLocation(pathname, searchParams)
    if (fromQuery) {
      return safeInternalPath(fromQuery, stayHere)
    }
    return safeInternalPath(stayHere, '/')
  }, [searchParams, pathname])

  // Open the dialog when arriving with `?login=1` (used by protected layout + /login redirect).
  useEffect(() => {
    if (searchParams.get('login') === '1' && !session?.user) {
      setAuthDialogOpen(true)
    }
  }, [searchParams, session?.user])

  const stripLoginQuery = (): void => {
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
  }

  const handleAuthDialogChange = (next: boolean): void => {
    setAuthDialogOpen(next)
    if (!next) {
      stripLoginQuery()
    }
  }

  useEffect(() => {
    let ticking = false

    const handleScroll = (): void => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY

          if (currentScrollY > 50 && currentScrollY > lastScrollY.current) {
            setIsHeaderHidden(true)
          } else if (currentScrollY < lastScrollY.current || currentScrollY < 30) {
            setIsHeaderHidden(false)
          }

          lastScrollY.current = currentScrollY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ease-out ${
          isHeaderHidden ? 'md:translate-y-0 -translate-y-full' : 'translate-y-0'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-20 w-full items-center justify-between px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2 hover:bg-transparent"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Menu</span>
          </Button>

          <Link href="/" className="flex items-center space-x-2 ml-1 md:ml-5">
            <Image
              src="/Assets/hidrosync_logo.png"
              alt="HidroSync"
              width={200}
              height={64}
              className="h-14 w-auto md:h-16"
              priority
            />
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end pr-2 md:pr-6">
            {session?.user ? (
              <UserMenu user={session.user} />
            ) : (
              <Button
                className="bg-hidrostone text-white hover:bg-hidrostone/90 border-0 rounded-[4px]"
                size="sm"
                type="button"
                data-testid="header-login-button"
                onClick={() => setAuthDialogOpen(true)}
              >
                <span className="font-bold uppercase text-xs md:text-sm">Entrar</span>
              </Button>
            )}
          </div>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] rounded-r-[4px]">
            <SheetHeader>
              <SheetTitle className="font-bold text-xl text-hidrostone">Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-2 mt-8">
              {mobileLinks.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`text-base font-semibold py-3 px-4 transition-colors rounded-[4px] ${
                      isActive ? 'bg-hidrogreen text-white' : 'text-black hover:bg-quicksilver'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      <div
        className={`fixed left-1/2 -translate-x-1/2 z-[55] md:hidden transition-all duration-300 ease-out ${
          isHeaderHidden ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'
        }`}
        style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="liquid-glass w-[200px] h-[44px] flex items-center justify-center overflow-hidden">
          <Image
            src="/Assets/hidrosync_logo.png"
            alt="HidroSync"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>
      </div>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={handleAuthDialogChange}
        redirectAfterLogin={redirectAfterLogin}
        showGoogle={showGoogle}
      />
    </>
  )
}
