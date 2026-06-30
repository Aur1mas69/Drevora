import type { HolidayRequestSummaryStats } from '@/lib/holidayRequestTypes'
import { CalendarClock, CalendarDays, CheckCircle2, Clock } from 'lucide-react'

type HolidayRequestsSummaryCardsProps = {
  stats: HolidayRequestSummaryStats
}

const cards = [
  {
    key: 'pendingRequests' as const,
    label: 'Pending Requests',
    icon: Clock,
    accent: 'text-amber-600 bg-amber-50 ring-amber-100',
  },
  {
    key: 'approvedThisMonth' as const,
    label: 'Approved This Month',
    icon: CheckCircle2,
    accent: 'text-emerald-600 bg-emerald-50 ring-emerald-100',
  },
  {
    key: 'workersOffToday' as const,
    label: 'Workers Off Today',
    icon: CalendarDays,
    accent: 'text-[#2563EB] bg-blue-50 ring-blue-100',
  },
  {
    key: 'upcomingLeave' as const,
    label: 'Upcoming Leave',
    icon: CalendarClock,
    accent: 'text-violet-600 bg-violet-50 ring-violet-100',
  },
]

export function HolidayRequestsSummaryCards({ stats }: HolidayRequestsSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.key}
            className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white p-4 shadow-[0_2px_8px_rgba(40,80,140,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em] text-[#2A376F]">
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
