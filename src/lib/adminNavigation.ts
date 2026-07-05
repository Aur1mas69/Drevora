import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BarChart3,
  Bell,
  BookUser,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileBarChart,
  FileText,
  HelpCircle,
  Key,
  LayoutDashboard,
  Package,
  Plug,
  Rocket,
  ScrollText,
  Settings,
  ShieldCheck,
  Terminal,
  Truck,
  UserCog,
  Users,
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
  { label: 'Workers', to: '/drivers', icon: Users },
  { label: 'Vehicles', to: '/vehicles', icon: Truck },
  { label: 'Timesheets', to: '/admin/timesheets', icon: ClipboardCheck },
  { label: 'Holiday Requests', to: '/admin/holidays', icon: CalendarDays },
  { label: 'Vehicle Checks', to: '/admin/vehicle-checks', icon: ShieldCheck },
  { label: 'Driver Reports', to: '/admin/driver-reports', icon: FileBarChart },
  {
    label: 'Documents',
    to: '/documents',
    icon: FileText,
    matchPaths: ['/documents', '/compliance'],
  },
  { label: 'Contacts', to: '/contacts', icon: BookUser },
  { label: 'Consumables', to: '/consumables', icon: Package },
]

/** Settings and support modules shown below the sidebar divider. */
export const adminSecondaryNavigationItems: AdminNavItem[] = [
  { label: 'Settings', to: '/admin/settings', icon: Settings },
  { label: 'FAQ / Help', to: '/admin/faq', icon: HelpCircle },
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
  if (path.startsWith('/documents/workers/') || path.startsWith('/documents/vehicles/')) {
    return false
  }
  return comingSoonAdminRoutes.has(path)
}
