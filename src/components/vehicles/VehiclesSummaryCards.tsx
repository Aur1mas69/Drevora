import type { FleetSummaryStats } from '@/lib/vehiclePageUtils'
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
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    surface: 'bg-[#EEF4FF]',
  },
  {
    key: 'offRoad' as const,
    label: 'Off-Road',
    icon: AlertTriangle,
    accent: 'bg-rose-50 text-rose-700 ring-rose-100',
    surface: 'bg-[#EAF2FF]',
  },
  {
    key: 'maintenanceDue' as const,
    label: 'Maintenance Due',
    icon: Wrench,
    accent: 'bg-amber-50 text-amber-700 ring-amber-100',
    surface: 'bg-[#E8F1FF]',
  },
  {
    key: 'motExpiringSoon' as const,
    label: 'MOT Expiring Soon',
    icon: CalendarClock,
    accent: 'bg-orange-50 text-orange-700 ring-orange-100',
    surface: 'bg-[#EEF4FF]',
  },
  {
    key: 'insuranceExpiringSoon' as const,
    label: 'Insurance Expiring Soon',
    icon: Shield,
    accent: 'bg-violet-50 text-violet-700 ring-violet-100',
    surface: 'bg-[#EAF2FF]',
  },
  {
    key: 'withoutDriver' as const,
    label: 'Vehicles Without Driver',
    icon: UserX,
    accent: 'bg-slate-100 text-slate-700 ring-slate-200',
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
            className={`rounded-[16px] border border-[rgba(75,120,220,0.10)] p-4 shadow-[0_4px_16px_rgba(40,80,140,0.05)] ${card.surface}`}
          >
            <div
              className={`mb-3 flex size-9 items-center justify-center rounded-full ring-1 ${card.accent}`}
            >
              <Icon className="size-4" strokeWidth={2} />
            </div>
            {isLoading ? (
              <div className="h-8 w-12 animate-pulse rounded-md bg-white/70" />
            ) : (
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[#2A376F]">
                {value}
              </p>
            )}
            <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
              {card.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
