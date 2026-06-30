import type { TimesheetSummaryStats } from '@/lib/timesheetTypes'
import { CheckCircle2, Clock3, Send } from 'lucide-react'

const cards = [
  {
    key: 'driversSubmitted' as const,
    label: 'Drivers Submitted',
    icon: Send,
    accent: 'bg-blue-50 text-blue-700 ring-blue-100',
    surface: 'bg-[#EEF4FF]',
  },
  {
    key: 'pendingApproval' as const,
    label: 'Pending Approval',
    icon: Clock3,
    accent: 'bg-amber-50 text-amber-700 ring-amber-100',
    surface: 'bg-[#EAF2FF]',
  },
  {
    key: 'approved' as const,
    label: 'Approved',
    icon: CheckCircle2,
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    surface: 'bg-[#E8F1FF]',
  },
]

type TimesheetsSummaryCardsProps = {
  stats: TimesheetSummaryStats
}

export function TimesheetsSummaryCards({ stats }: TimesheetsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        const value = String(stats[card.key])

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
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[#2A376F]">
              {value}
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">
              {card.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}
