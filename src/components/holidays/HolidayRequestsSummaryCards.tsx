import type { HolidayRequestSummaryStats } from '@/lib/holidayRequestTypes'
import { adminHeading, adminMetricCardSm, adminTextMuted } from '@/lib/adminUiStyles'
import { CalendarClock, CalendarDays, CheckCircle2, Clock } from 'lucide-react'

type HolidayRequestsSummaryCardsProps = {
  stats: HolidayRequestSummaryStats
}

const cards = [
  {
    key: 'pendingRequests' as const,
    label: 'Pending Requests',
    icon: Clock,
    accent:
      'text-amber-600 bg-amber-50 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  },
  {
    key: 'approvedThisMonth' as const,
    label: 'Approved This Month',
    icon: CheckCircle2,
    accent:
      'text-emerald-600 bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  },
  {
    key: 'workersOffToday' as const,
    label: 'Workers Off Today',
    icon: CalendarDays,
    accent:
      'text-[#2563EB] bg-blue-50 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
  },
  {
    key: 'upcomingLeave' as const,
    label: 'Upcoming Leave',
    icon: CalendarClock,
    accent:
      'text-violet-600 bg-violet-50 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
  },
]

export function HolidayRequestsSummaryCards({ stats }: HolidayRequestsSummaryCardsProps) {
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
