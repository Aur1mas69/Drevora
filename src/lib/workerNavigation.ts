import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  ClipboardCheck,
  Contact,
  FileText,
  NotebookPen,
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

export const WORKER_NOTES_PATH = '/worker/notes'

/** Final Worker main menu order. */
export const WORKER_NAV_ITEMS: readonly WorkerNavItem[] = [
  {
    id: 'timesheets',
    label: 'Timesheets',
    shortLabel: 'Timesheets',
    to: '/worker/timesheets',
    icon: ClipboardCheck,
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
    id: 'documents',
    label: 'Documents',
    shortLabel: 'Documents',
    to: '/worker/documents',
    icon: FileText,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    shortLabel: 'Contacts',
    to: '/worker/contacts',
    icon: Contact,
  },
  {
    id: 'notes',
    label: 'Notes',
    shortLabel: 'Notes',
    to: WORKER_NOTES_PATH,
    icon: NotebookPen,
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

/** Worker Home "Quick actions" — exactly 4 cards in a 2x2 grid. */
export function getWorkerHomeQuickActionItems(): WorkerNavItem[] {
  return WORKER_NAV_ITEMS.filter(
    (item) =>
      item.id === 'timesheets' ||
      item.id === 'holidays' ||
      item.id === 'vehicles' ||
      item.id === 'documents',
  )
}

/**
 * Persistent bottom navigation items after Home.
 * Home is rendered by MainLayout; bottom bar is exactly 4 items:
 * Home, Contacts, Notes, Settings. Sign out stays on Settings.
 */
export function getWorkerBottomNavItems(): WorkerNavItem[] {
  return WORKER_NAV_ITEMS.filter(
    (item) =>
      item.id === 'contacts' || item.id === 'notes' || item.id === 'settings',
  )
}

export function isWorkerNavPathActive(pathname: string, to: string): boolean {
  if (to === WORKER_HOME_PATH) {
    return pathname === WORKER_HOME_PATH
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}
