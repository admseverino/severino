export interface AppNavItem {
  label: string
  href: string
}

const BASE_NAV: AppNavItem[] = [
  { label: 'HOME', href: '/' },
  { label: 'MEDIDORES', href: '/meters' },
  { label: 'LEITURAS', href: '/reading' },
  { label: 'CONSUMO', href: '/consumption' },
  { label: 'PAGAMENTOS', href: '/billing' },
  { label: 'CONFIGURAÇÕES', href: '/account' },
]

const STAFF_ONBOARDING: AppNavItem = { label: 'ONBOARDING', href: '/onboarding' }

/** Main app navigation: staff see onboarding after Home (same on desktop and mobile). */
export function getAppNavItems(isStaff: boolean): AppNavItem[] {
  if (!isStaff) {
    return BASE_NAV.slice()
  }
  const home = BASE_NAV[0]
  if (!home) {
    return BASE_NAV.slice()
  }
  return [home, STAFF_ONBOARDING, ...BASE_NAV.slice(1)]
}
