export type AppNavIcon =
  | 'home'
  | 'meters'
  | 'reading'
  | 'consumption'
  | 'billing'
  | 'account'
  | 'onboarding'

export interface AppNavItem {
  label: string
  href: string
  icon: AppNavIcon
}

const BASE_NAV: AppNavItem[] = [
  { label: 'HOME', href: '/', icon: 'home' },
  { label: 'MEDIDORES', href: '/meters', icon: 'meters' },
  { label: 'LEITURAS', href: '/reading', icon: 'reading' },
  { label: 'CONSUMO', href: '/consumption', icon: 'consumption' },
  { label: 'PAGAMENTOS', href: '/billing', icon: 'billing' },
  { label: 'CONFIGURAÇÕES', href: '/account', icon: 'account' },
]

const STAFF_ONBOARDING: AppNavItem = {
  label: 'ONBOARDING',
  href: '/onboarding',
  icon: 'onboarding',
}

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

/** localStorage key for desktop sidebar collapsed state */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'hidrosync.sidebar.collapsed'
