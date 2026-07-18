import { adminBadgeDark } from '@/lib/adminUiStyles'
import type { VehicleStatus } from '@/services/vehiclesService'

export const statusClassMap: Record<VehicleStatus, string> = {
  Available: `bg-emerald-50 text-emerald-700 ring-emerald-200 ${adminBadgeDark.emerald}`,
  Assigned: `bg-[#EEF6FF] text-[#0B68BE] ring-[#C5DFFB] ${adminBadgeDark.blue}`,
  Workshop: `bg-orange-50 text-orange-700 ring-orange-200 ${adminBadgeDark.orange}`,
  Maintenance: `bg-amber-50 text-amber-800 ring-amber-200 ${adminBadgeDark.amber}`,
  'Out of Service': `bg-rose-50 text-rose-700 ring-rose-200 ${adminBadgeDark.rose}`,
  'Off Road':
    'bg-slate-900 text-white ring-slate-950 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700',
  Reserved: `bg-violet-50 text-violet-700 ring-violet-200 ${adminBadgeDark.violet}`,
}

export const calendarClassMap: Record<VehicleStatus, string> = {
  Available: 'bg-emerald-600',
  Assigned: 'bg-[#218EE7]',
  Workshop: 'bg-amber-500',
  Maintenance: 'bg-orange-500',
  'Out of Service': 'bg-rose-700',
  'Off Road': 'bg-slate-900',
  Reserved: 'bg-violet-600',
}

export const statusEmojiMap: Record<VehicleStatus, string> = {
  Available: '🟢',
  Assigned: '🔵',
  Workshop: '🟡',
  Maintenance: '🟠',
  'Out of Service': '⚫',
  'Off Road': '🔴',
  Reserved: '🟣',
}

type VehicleStatusBadgeProps = {
  status: VehicleStatus
  onClick?: () => void
  className?: string
}

export function VehicleStatusBadge({
  status,
  onClick,
  className = '',
}: VehicleStatusBadgeProps) {
  const label = status === 'Off Road' ? 'OFF ROAD' : status
  const Component = onClick ? 'button' : 'span'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-all duration-[250ms] ${statusClassMap[status]} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-500/40'
          : ''
      } ${className}`}
    >
      {label}
    </Component>
  )
}
