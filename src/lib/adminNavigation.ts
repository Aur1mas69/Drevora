import type { LucideIcon } from 'lucide-react'
import {
  Archive,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Download,
  FileBarChart,
  Key,
  LayoutDashboard,
  Plug,
  ScrollText,
  Settings,
  Shield,
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
}

/** Primary MVP sidebar navigation. */
export const adminNavigationItems: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Workers', to: '/drivers', icon: Users },
  { label: 'Vehicles', to: '/vehicles', icon: Truck },
  { label: 'Timesheets', to: '/admin/timesheets', icon: ClipboardCheck },
  { label: 'Holiday Requests', to: '/admin/holidays', icon: CalendarDays },
  { label: 'Vehicle Checks', to: '/admin/vehicle-checks', icon: ShieldCheck },
  { label: 'Driver Reports', to: '/admin/driver-reports', icon: FileBarChart },
  { label: 'Compliance', to: '/compliance', icon: Shield },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

/** Hidden from sidebar; routes remain for future modules. */
export const hiddenAdminNavigationItems: AdminNavItem[] = [
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
  '/compliance',
  '/admin/settings',
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
