import type { FleetSummaryStats } from '@/lib/vehiclePageUtils'
import {
  vehicleKpiVisualStyles,
  type VehicleKpiKey,
} from '@/components/vehicles/vehicleSummaryKpiStyles'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CalendarClock,
  Shield,
  Truck,
  Wrench,
} from 'lucide-react'

const cards: Array<{
  key: VehicleKpiKey
  label: string
  helper: string
  icon: LucideIcon
}> = [
  {
    key: 'available',
    label: 'Available Vehicles',
    helper: 'Ready for assignment',
    icon: Truck,
  },
  {
    key: 'offRoad',
    label: 'Off-Road',
    helper: 'Off road or out of service',
    icon: AlertTriangle,
  },
  {
    key: 'maintenanceDue',
    label: 'Maintenance Due',
    helper: 'Service due soon',
    icon: Wrench,
  },
  {
    key: 'motExpiringSoon',
    label: 'MOT Expiring Soon',
    helper: 'Within warning window',
    icon: CalendarClock,
  },
  {
    key: 'insuranceExpiringSoon',
    label: 'Insurance Expiring Soon',
    helper: 'Within warning window',
    icon: Shield,
  },
]

type VehiclesSummaryCardsProps = {
  stats: FleetSummaryStats
  isLoading?: boolean
  activeKey?: VehicleKpiKey | null
  onSelect?: (key: VehicleKpiKey) => void
}

function VehicleKpiCard({
  label,
  helper,
  icon: Icon,
  value,
  isLoading,
  styleKey,
  isActive,
  onSelect,
}: {
  label: string
  helper: string
  icon: LucideIcon
  value: number
  isLoading: boolean
  styleKey: VehicleKpiKey
  isActive: boolean
  onSelect?: (key: VehicleKpiKey) => void
}) {
  const style = vehicleKpiVisualStyles[styleKey]
  const interactive = typeof onSelect === 'function'

  const className = [
    'group relative overflow-hidden rounded-2xl border border-l-4 p-3.5 text-left transition-all duration-[180ms] ease-out sm:p-4',
    style.baseGradient,
    style.baseBorder,
    style.leftBorder,
    style.baseShadow,
    interactive
      ? `cursor-pointer hover:-translate-y-[3px] active:-translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7]/45 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${style.hoverGradient} ${style.hoverBorder} ${style.hoverShadow}`
      : '',
    isActive
      ? 'z-[1] -translate-y-px scale-[0.995] border-2 shadow-[0_0_0_1px_rgba(17,60,105,0.12),0_12px_28px_rgba(17,60,105,0.14)] ring-2 ring-[#113C69]/20 dark:border-slate-100/30 dark:shadow-[0_0_0_1px_rgba(59,130,246,0.2),0_12px_28px_rgba(0,0,0,0.4)] dark:ring-blue-400/30'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <div
        className={`pointer-events-none absolute -right-5 -top-5 size-20 rounded-full blur-2xl transition-opacity duration-200 ${style.glowClass} ${
          isActive ? 'opacity-70' : 'opacity-35 group-hover:opacity-50'
        }`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 group-hover:brightness-[1.03] sm:size-11 sm:rounded-2xl ${style.iconWrap} ${
            isActive ? 'ring-2 ring-current/20' : ''
          }`}
        >
          <Icon className={`size-4 sm:size-[1.125rem] ${style.iconClass}`} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-white/60 dark:bg-slate-700/60" />
          ) : (
            <p
              className={`text-2xl font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-3xl ${style.valueClass}`}
            >
              {value}
            </p>
          )}
          <p className={`mt-2 text-xs font-semibold leading-snug sm:text-sm ${style.labelClass}`}>
            <span className="line-clamp-2">{label}</span>
          </p>
          <p className={`mt-0.5 hidden text-[11px] leading-snug sm:block ${style.subtitleClass}`}>
            {helper}
          </p>
        </div>
      </div>
    </>
  )

  if (!interactive) {
    return <article className={className}>{content}</article>
  }

  return (
    <button
      type="button"
      className={className}
      aria-pressed={isActive}
      aria-label={`${label}: ${value}. ${isActive ? 'Clear filter' : 'Apply filter'}`}
      onClick={() => onSelect(styleKey)}
    >
      {content}
    </button>
  )
}

export function VehiclesSummaryCards({
  stats,
  isLoading = false,
  activeKey = null,
  onSelect,
}: VehiclesSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <VehicleKpiCard
          key={card.key}
          label={card.label}
          helper={card.helper}
          icon={card.icon}
          value={stats[card.key]}
          isLoading={isLoading}
          styleKey={card.key}
          isActive={activeKey === card.key}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
