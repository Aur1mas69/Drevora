import type { VehicleStatus } from '@/services/vehiclesService'

export const statusClassMap: Record<VehicleStatus, string> = {
  Available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  Workshop: 'bg-orange-50 text-orange-700 ring-orange-200',
  Maintenance: 'bg-amber-50 text-amber-700 ring-amber-200',
  'Out of Service': 'bg-rose-50 text-rose-700 ring-rose-200',
  'Off Road': 'bg-rose-600 text-white ring-rose-700',
  Reserved: 'bg-purple-50 text-purple-700 ring-purple-200',
}

export const calendarClassMap: Record<VehicleStatus, string> = {
  Available: 'bg-emerald-500',
  Assigned: 'bg-blue-500',
  Workshop: 'bg-yellow-400',
  Maintenance: 'bg-orange-500',
  'Out of Service': 'bg-red-600',
  'Off Road': 'bg-slate-950',
  Reserved: 'bg-purple-500',
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
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200'
          : ''
      } ${className}`}
    >
      {label}
    </Component>
  )
}
