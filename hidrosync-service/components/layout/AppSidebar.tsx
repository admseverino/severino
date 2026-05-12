'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardPenLine,
  CreditCard,
  Gauge,
  Home,
  type LucideIcon,
  Settings,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { isStaffRole } from '@/lib/admin-rbac'
import { cn } from '@/lib/utils'
import {
  getAppNavItems,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  type AppNavIcon,
  type AppNavItem,
} from '@/modules/navigation'

const NAV_ICONS: Record<AppNavIcon, LucideIcon> = {
  home: Home,
  meters: Gauge,
  reading: ClipboardList,
  consumption: BarChart3,
  billing: CreditCard,
  account: Settings,
  onboarding: ClipboardPenLine,
}

export function AppSidebar(): React.JSX.Element {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedReady, setCollapsedReady] = useState(false)

  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
      setCollapsed(raw === 'true')
    } catch {
      setCollapsed(false)
    }
    setCollapsedReady(true)
  }, [])

  const menuItems = useMemo(
    () => getAppNavItems(isStaffRole(session?.user?.role)),
    [session?.user?.role]
  )

  const setCollapsedPersist = (next: boolean): void => {
    setCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
    } catch {
      /* ignore quota / private mode */
    }
  }

  const isActive = (item: AppNavItem): boolean => {
    if (item.href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(item.href)
  }

  const linkBody = (item: AppNavItem, Icon: LucideIcon, active: boolean): React.JSX.Element => (
    <span
      className={cn(
        'flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm font-semibold transition-colors',
        active ? 'bg-hidrogreen text-white' : 'text-foreground hover:bg-quicksilver',
        collapsed && 'justify-center px-0'
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </span>
  )

  return (
    <aside
      id="app-sidebar"
      className={cn(
        'relative z-10 hidden min-h-0 shrink-0 flex-col border-r border-border bg-card md:flex md:h-full md:min-h-0',
        collapsedReady ? 'transition-[width] duration-200 ease-out' : '',
        collapsed ? 'w-16' : 'w-60'
      )}
      aria-label="Navegação principal"
    >
      <div
        className={cn(
          'flex shrink-0 border-b border-border p-2',
          collapsed ? 'flex-col items-center gap-2' : 'flex-row items-center justify-between gap-2'
        )}
      >
        {!collapsed ? (
          <span className="truncate text-xs font-bold uppercase tracking-wide text-hidrostone">Menu</span>
        ) : null}
        {!collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-[4px]"
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            onClick={() => setCollapsedPersist(true)}
            aria-label="Recolher menu"
          >
            <ChevronLeft className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-[4px]"
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            onClick={() => setCollapsedPersist(false)}
            aria-label="Expandir menu"
          >
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      <nav id="app-sidebar-nav" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {menuItems.map((item) => {
          const Icon = NAV_ICONS[item.icon]
          const active = isActive(item)
          const inner = linkBody(item, Icon, active)

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href} className="block outline-none" title={item.label}>
                    {inner}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Link key={item.href} href={item.href} className="block outline-none">
              {inner}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
