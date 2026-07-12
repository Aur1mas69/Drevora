import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  ContactRound,
  Download,
  Droplets,
  FileBarChart,
  FileWarning,
  Files,
  Key,
  LayoutDashboard,
  Plug,
  Rocket,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Terminal,
  Truck,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'

export type AdminNavItem = {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  /** Additional path prefixes that should mark this item active. */
  matchPaths?: string[]
  /** Visible in sidebar but not navigable until the module exists. */
  comingLater?: boolean
}

/** Daily-operation modules shown above the sidebar divider. */
export const adminMainNavigationItems: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Workers', to: '/drivers', icon: UsersRound },
  { label: 'Vehicles', to: '/vehicles', icon: Truck },
  { label: 'Timesheets', to: '/admin/timesheets', icon: Clock3 },
  { label: 'Holiday Requests', to: '/admin/holidays', icon: CalendarDays },
  { label: 'Vehicle Checks', to: '/admin/vehicle-checks', icon: ClipboardCheck },
  { label: 'Consumables', to: '/consumables', icon: Droplets },
  { label: 'Driver Reports', to: '/admin/driver-reports', icon: FileWarning },
  {
    label: 'Documents',
    to: '/documents',
    icon: Files,
    matchPaths: ['/documents', '/compliance'],
  },
  { label: 'Contacts', to: '/contacts', icon: ContactRound },
]

/** Settings and support modules shown below the sidebar divider. */
export const adminSecondaryNavigationItems: AdminNavItem[] = [
  { label: 'Settings', to: '/admin/settings', icon: Settings },
  { label: 'Terms & Conditions', to: '/terms', icon: Scale },
  { label: 'Privacy Policy', to: '/privacy', icon: ShieldCheck },
  { label: 'FAQ / Help', to: '/admin/faq', icon: CircleHelp },
]

/** Full sidebar navigation in display order (main, then secondary). */
export const adminNavigationItems: AdminNavItem[] = [
  ...adminMainNavigationItems,
  ...adminSecondaryNavigationItems,
]

/** Hidden from sidebar; routes remain for future modules. */
export const hiddenAdminNavigationItems: AdminNavItem[] = [
  {
    label: 'Future Features',
    to: '/admin/future-features',
    icon: Rocket,
    comingLater: true,
  },
  { label: 'Reports', to: '/admin/reports', icon: FileBarChart, end: true },
  { label: 'Analytics', to: '/admin/reports/analytics', icon: BarChart3 },
  { label: 'Exports', to: '/admin/reports/exports', icon: Download },
  { label: 'User Management', to: '/admin/users', icon: Users },
  { label: 'Roles & Permissions', to: '/admin/roles', icon: UserCog },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
  { label: 'Integrations', to: '/admin/integrations', icon: Plug },
  { label: 'Billing', to: '/admin/billing', icon: Building2 },
  { label: 'API Keys', to: '/admin/api-keys', icon: Key },
  { label: 'Audit Log', to: '/admin/audit-log', icon: ScrollText },
  { label: 'System Logs', to: '/admin/system-logs', icon: Terminal },
  { label: 'Backups', to: '/admin/backups', icon: Archive },
]

/** Routes that render a real module (not Coming Soon). */
export const activeAdminRoutes = new Set([
  '/admin',
  '/drivers',
  '/vehicles',
  '/admin/timesheets',
  '/admin/holidays',
  '/admin/vehicle-checks',
  '/documents',
  '/contacts',
  '/consumables',
  '/admin/settings',
  '/terms',
  '/privacy',
  '/admin/faq',
])

export const comingSoonAdminRoutes = new Set([
  '/admin/driver-reports',
  ...hiddenAdminNavigationItems.map((item) => item.to),
])

export function isComingSoonRoute(path: string): boolean {
  if (activeAdminRoutes.has(path)) return false
  if (path.startsWith('/drivers/') || path.startsWith('/vehicles/')) return false
  if (path.startsWith('/compliance/workers/') || path.startsWith('/compliance/vehicles/')) {
    return false
  }
  return comingSoonAdminRoutes.has(path)
}
