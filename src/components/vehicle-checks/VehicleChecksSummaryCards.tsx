import type { VehicleCheckSummaryStats } from '@/lib/vehicleCheckTypes'
import { adminHeading, adminMetricCardSm, adminTextMuted } from '@/lib/adminUiStyles'
import { AlertTriangle, CalendarCheck, ClipboardCheck, Truck } from 'lucide-react'

type VehicleChecksSummaryCardsProps = {
  stats: VehicleCheckSummaryStats
}

const cards = [
  {
    key: 'checksToday' as const,
    label: 'Checks Today',
    icon: CalendarCheck,
    accent:
      'text-[#2563EB] bg-blue-50 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
  },
  {
    key: 'openDefects' as const,
    label: 'Open Defects',
    icon: AlertTriangle,
    accent:
      'text-amber-600 bg-amber-50 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  },
  {
    key: 'vehiclesChecked' as const,
    label: 'Vehicles Checked',
    icon: Truck,
    accent:
      'text-violet-600 bg-violet-50 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
  },
  {
    key: 'failedInspections' as const,
    label: 'Failed Inspections',
    icon: ClipboardCheck,
    accent:
      'text-rose-600 bg-rose-50 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
  },
]

export function VehicleChecksSummaryCards({ stats }: VehicleChecksSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.key} className={`${adminMetricCardSm} dark:bg-slate-900/70`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs font-medium ${adminTextMuted}`}>{card.label}</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em] ${adminHeading}`}
                >
                  {stats[card.key]}
                </p>
              </div>
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ${card.accent}`}
              >
                <Icon className="size-4" aria-hidden="true" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
