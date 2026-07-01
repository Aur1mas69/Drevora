import type { FleetSummaryStats } from '@/lib/vehiclePageUtils'
import { adminHeading, adminMetricCard, adminSkeletonPulse, adminTextMuted } from '@/lib/adminUiStyles'
import {
  AlertTriangle,
  CalendarClock,
  Shield,
  Truck,
  UserX,
  Wrench,
} from 'lucide-react'

const cards = [
  {
    key: 'available' as const,
    label: 'Available Vehicles',
    icon: Truck,
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
    surface: 'bg-[#EEF4FF]',
  },
  {
    key: 'offRoad' as const,
    label: 'Off-Road',
    icon: AlertTriangle,
    accent: 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
    surface: 'bg-[#EAF2FF]',
  },
  {
    key: 'maintenanceDue' as const,
    label: 'Maintenance Due',
    icon: Wrench,
    accent: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
    surface: 'bg-[#E8F1FF]',
  },
  {
    key: 'motExpiringSoon' as const,
    label: 'MOT Expiring Soon',
    icon: CalendarClock,
    accent: 'bg-orange-50 text-orange-700 ring-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
    surface: 'bg-[#EEF4FF]',
  },
  {
    key: 'insuranceExpiringSoon' as const,
    label: 'Insurance Expiring Soon',
    icon: Shield,
    accent: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
    surface: 'bg-[#EAF2FF]',
  },
  {
    key: 'withoutDriver' as const,
    label: 'Vehicles Without Driver',
    icon: UserX,
    accent: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
    surface: 'bg-[#E8F1FF]',
  },
]

type VehiclesSummaryCardsProps = {
  stats: FleetSummaryStats
  isLoading?: boolean
}

export function VehiclesSummaryCards({
  stats,
  isLoading = false,
}: VehiclesSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon
        const value = stats[card.key]

        return (
          <div
            key={card.key}
            className={`${adminMetricCard} ${card.surface} dark:bg-slate-900/70`}
          >
            <div
              className={`mb-3 flex size-9 items-center justify-center rounded-full ring-1 ${card.accent}`}
            >
              <Icon className="size-4" strokeWidth={2} />
            </div>
            {isLoading ? (
              <div className={`h-8 w-12 rounded-md ${adminSkeletonPulse} bg-white/70 dark:bg-slate-800/60`} />
            ) : (
              <p className={`text-2xl font-semibold tracking-[-0.04em] ${adminHeading}`}>
                {value}
              </p>
            )}
            <p className={`mt-1 text-[11px] font-semibold leading-4 ${adminTextMuted}`}>
              {card.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
