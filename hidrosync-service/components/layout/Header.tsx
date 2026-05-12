'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Menu } from 'lucide-react'

import { useAuthLogin } from '@/components/layout/auth-login-context'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { isStaffRole } from '@/lib/admin-rbac'
import { getAppNavItems, type AppNavItem } from '@/modules/navigation'

const MARKETING_NAV: AppNavItem[] = [{ label: 'HOME', href: '/', icon: 'home' }]

interface HeaderProps {
  /** When false, mobile sheet uses only marketing links (no app nav). */
  showFullNav?: boolean
  /** Server-resolved: only true when GOOGLE_CLIENT_ID/SECRET are configured. */
  showGoogle: boolean
}

export function Header({ showFullNav = true, showGoogle: _showGoogle }: HeaderProps): React.JSX.Element {
  void _showGoogle
  const { data: session } = useSession()
  const pathname = usePathname()
  const { openLogin } = useAuthLogin()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)

  const mobileLinks = useMemo(() => {
    if (!showFullNav) {
      return MARKETING_NAV
    }
    return getAppNavItems(isStaffRole(session?.user?.role))
  }, [showFullNav, session?.user?.role])

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
            className="mr-2 hover:bg-transparent md:hidden"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Menu</span>
          </Button>

          <Link href="/" className="ml-1 flex items-center space-x-2 md:ml-5">
            <Image
              src="/Assets/HidroSync_Logo_1.svg"
              alt="HidroSync"
              width={752}
              height={752}
              className="h-14 w-auto md:h-16"
              priority
              unoptimized
            />
          </Link>

          <div className="flex min-w-0 flex-1 items-center justify-end pr-2 md:pr-6">
            {session?.user ? (
              <UserMenu user={session.user} />
            ) : (
              <Button
                className="rounded-[4px] border-0 bg-hidrostone text-white hover:bg-hidrostone/90"
                size="sm"
                type="button"
                data-testid="header-login-button"
                onClick={openLogin}
              >
                <span className="text-xs font-bold uppercase md:text-sm">Entrar</span>
              </Button>
            )}
          </div>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] rounded-r-[4px] sm:w-[320px]">
            <SheetHeader>
              <SheetTitle className="text-xl font-bold text-hidrostone">Menu</SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-2">
              {mobileLinks.map((item) => {
                const isActive =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-[4px] px-4 py-3 text-base font-semibold transition-colors ${
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
        className={`fixed left-1/2 z-[55] -translate-x-1/2 transition-all duration-300 ease-out md:hidden ${
          isHeaderHidden ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-8 opacity-0'
        }`}
        style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="liquid-glass flex h-[44px] w-[200px] items-center justify-center overflow-hidden">
          <Image
            src="/Assets/HidroSync_Logo_1.svg"
            alt="HidroSync"
            width={752}
            height={752}
            className="h-10 w-auto"
            priority
            unoptimized
          />
        </div>
      </div>
    </>
  )
}
