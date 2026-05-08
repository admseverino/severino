'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const menuItems = [
  { label: 'HOME', href: '/' },
  { label: 'MEDIDORES', href: '/meters' },
  { label: 'LEITURAS', href: '/reading' },
  { label: 'CONSUMO', href: '/consumption' },
  { label: 'PAGAMENTOS', href: '/billing' },
  { label: 'CONFIGURAÇÕES', href: '/account' },
] as const

export function NavigationMenu(): React.JSX.Element {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  const activeIndex = menuItems.findIndex((item) => {
    if (item.href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(item.href)
  })

  const slidePosition = activeIndex >= 0 ? (activeIndex / menuItems.length) * 100 : 0
  const slideWidth = 100 / menuItems.length
  const showSlider = activeIndex >= 0

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY < 10) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  return (
    <nav
      className={cn(
        'hidden md:block w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b sticky top-20 z-40 transition-all duration-300 h-16',
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      )}
    >
      <div className="relative w-full h-16">
        {showSlider ? (
          <div
            className="absolute top-0 bottom-0 bg-hidrogreen transition-all duration-400"
            style={{
              left: `${slidePosition}%`,
              width: `${slideWidth}%`,
              transitionTimingFunction: 'cubic-bezier(0.34, 1.25, 0.64, 1)',
            }}
          />
        ) : null}

        <div className="relative flex h-full w-full">
          {menuItems.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-1 flex items-center justify-center font-black italic uppercase text-xs lg:text-sm transition-colors duration-300',
                  isActive ? 'text-white' : 'text-black hover:text-hidrostone'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
