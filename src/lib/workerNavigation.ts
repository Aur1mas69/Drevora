import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  ClipboardList,
  Contact,
  FileWarning,
  Settings,
  Truck,
} from 'lucide-react'
import { WORKER_HOME_PATH } from '@/lib/membershipRoles'

export { WORKER_HOME_PATH }

/**
 * Central Worker navigation for verified company_members.role = Driver.
 * Must never be mixed into Office/AdminLayout navigation.
 * Consumables is intentionally omitted — reachable only via Vehicles → Add Consumable.
 */
export type WorkerNavItem = {
  id: string
  label: string
  to: string
  icon: LucideIcon
  /** Short label for bottom bar when space is tight. */
  shortLabel?: string
}

/** Final Worker main menu order. */
export const WORKER_NAV_ITEMS: readonly WorkerNavItem[] = [
  {
    id: 'timesheets',
    label: 'Timesheets',
    shortLabel: 'Timesheets',
    to: '/worker/timesheets',
    icon: ClipboardList,
  },
  {
    id: 'holidays',
    label: 'Holiday Requests',
    shortLabel: 'Holidays',
    to: '/worker/holidays',
    icon: CalendarDays,
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    shortLabel: 'Vehicles',
    to: '/worker/vehicles',
    icon: Truck,
  },
  {
    id: 'driver-reports',
    label: 'Driver Reports',
    shortLabel: 'Reports',
    to: '/worker/driver-reports',
    icon: FileWarning,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    shortLabel: 'Contacts',
    to: '/worker/contacts',
    icon: Contact,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    to: '/worker/settings',
    icon: Settings,
  },
] as const

/** Internal route used by Vehicles → Add Consumable (not a main menu item). */
export const WORKER_CONSUMABLES_PATH = '/worker/consumables'

export function getWorkerPrimaryNavItems(): WorkerNavItem[] {
  return WORKER_NAV_ITEMS.filter((item) =>
    item.id === 'timesheets' || item.id === 'holidays' || item.id === 'vehicles',
  )
}

export function getWorkerMoreNavItems(): WorkerNavItem[] {
  return WORKER_NAV_ITEMS.filter(
    (item) =>
      item.id !== 'timesheets' &&
      item.id !== 'holidays' &&
      item.id !== 'vehicles',
  )
}

export function isWorkerNavPathActive(pathname: string, to: string): boolean {
  if (to === WORKER_HOME_PATH) {
    return pathname === WORKER_HOME_PATH
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}
