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
}

function VehicleKpiCard({
  label,
  helper,
  icon: Icon,
  value,
  isLoading,
  styleKey,
}: {
  label: string
  helper: string
  icon: LucideIcon
  value: number
  isLoading: boolean
  styleKey: VehicleKpiKey
}) {
  const style = vehicleKpiVisualStyles[styleKey]

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-l-4 p-3.5 transition-all duration-[180ms] ease-out hover:-translate-y-[3px] active:-translate-y-px active:scale-[0.99] sm:p-4 ${style.baseGradient} ${style.baseBorder} ${style.leftBorder} ${style.baseShadow} ${style.hoverGradient} ${style.hoverBorder} ${style.hoverShadow}`}
    >
      <div
        className={`pointer-events-none absolute -right-5 -top-5 size-20 rounded-full blur-2xl opacity-35 transition-opacity duration-200 group-hover:opacity-50 ${style.glowClass}`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 group-hover:brightness-[1.03] sm:size-11 sm:rounded-2xl ${style.iconWrap}`}
        >
          <Icon className={`size-4 sm:size-[1.125rem] ${style.iconClass}`} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-white/60" />
          ) : (
            <p
              className={`text-2xl font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-3xl ${style.valueClass}`}
            >
              {value}
            </p>
          )}
          <p className={`mt-2 text-xs font-semibold leading-snug sm:text-sm ${style.labelClass}`}>
            {label}
          </p>
          <p className={`mt-0.5 hidden text-[11px] leading-snug sm:block ${style.subtitleClass}`}>
            {helper}
          </p>
        </div>
      </div>
    </article>
  )
}

export function VehiclesSummaryCards({
  stats,
  isLoading = false,
}: VehiclesSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <VehicleKpiCard
          key={card.key}
          label={card.label}
          helper={card.helper}
          icon={card.icon}
          value={stats[card.key]}
          isLoading={isLoading}
          styleKey={card.key}
        />
      ))}
    </div>
  )
}
