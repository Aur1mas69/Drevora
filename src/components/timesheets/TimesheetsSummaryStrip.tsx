import { TimesheetWeekLabel } from '@/components/timesheets/TimesheetWeekLabel'
import type { TimesheetSummaryStats } from '@/lib/timesheetTypes'
import {
  adminHeading,
  adminMetricCard,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Send,
  XCircle,
} from 'lucide-react'

type TimesheetsSummaryStripProps = {
  stats: TimesheetSummaryStats
  weekTitle: string
  weekRangeLabel: string
}

type KpiCardConfig = {
  key: string
  title: string
  subtitle: string
  icon: LucideIcon
  getValue: (stats: TimesheetSummaryStats) => number
  badgeClass: string
  glowClass: string
  hideWhenZero?: boolean
}

const cardClassName = `${adminMetricCard} transition-all duration-200 ease-out hover:-translate-y-0.5 dark:bg-slate-900/70`

const kpiCards: KpiCardConfig[] = [
  {
    key: 'total',
    title: 'Total',
    subtitle: 'Weekly timesheets',
    icon: ClipboardList,
    getValue: (stats) => stats.total,
    badgeClass:
      'bg-blue-100 text-blue-600 ring-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
    glowClass: 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.55)]',
  },
  {
    key: 'submitted',
    title: 'Submitted',
    subtitle: 'Waiting review',
    icon: Send,
    getValue: (stats) => stats.pendingApproval,
    badgeClass:
      'bg-sky-100 text-sky-600 ring-sky-200/60 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900/60',
    glowClass: 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.55)]',
  },
  {
    key: 'pending',
    title: 'Pending',
    subtitle: 'Drafts',
    icon: Clock3,
    getValue: (stats) => stats.drafts,
    badgeClass:
      'bg-orange-100 text-orange-600 ring-orange-200/60 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
    glowClass: 'bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.55)]',
  },
  {
    key: 'approved',
    title: 'Approved',
    subtitle: 'Signed off',
    icon: CheckCircle2,
    getValue: (stats) => stats.approved,
    badgeClass:
      'bg-green-100 text-green-600 ring-green-200/60 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-900/60',
    glowClass: 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.55)]',
  },
  {
    key: 'rejected',
    title: 'Rejected',
    subtitle: 'Needs correction',
    icon: XCircle,
    getValue: (stats) => stats.rejected,
    badgeClass:
      'bg-red-100 text-red-600 ring-red-200/60 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900/60',
    glowClass: 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.55)]',
    hideWhenZero: true,
  },
]

function KpiCard({ card, stats }: { card: KpiCardConfig; stats: TimesheetSummaryStats }) {
  const Icon = card.icon
  const value = card.getValue(stats)
  const isZero = value === 0

  return (
    <article
      className={`${cardClassName} ${isZero ? 'opacity-60 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className={`absolute -left-0.5 top-1/2 size-2 -translate-y-1/2 rounded-full ${card.glowClass}`}
          />
          <div
            className={`flex size-10 items-center justify-center rounded-full ring-1 transition-transform duration-200 ease-out group-hover:scale-110 ${card.badgeClass}`}
          >
            <Icon className="size-[18px]" strokeWidth={2.1} />
          </div>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`text-[1.65rem] font-bold leading-none tracking-[-0.04em] ${adminHeading}`}>
            {value}
          </p>
          <p className={`mt-2 text-[11px] font-semibold leading-tight ${adminHeading} opacity-80`}>
            {card.title}
          </p>
          <p className={`mt-0.5 text-[10px] font-medium leading-snug ${adminTextMuted}`}>
            {card.subtitle}
          </p>
        </div>
      </div>
    </article>
  )
}

export function TimesheetsSummaryStrip({
  stats,
  weekTitle,
  weekRangeLabel,
}: TimesheetsSummaryStripProps) {
  const visibleCards = kpiCards.filter((card) => {
    if (!card.hideWhenZero) return true
    return card.getValue(stats) > 0
  })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold uppercase tracking-[0.1em] ${adminTextMuted}`}>
          Week summary
        </p>
        <div className={`text-right text-sm ${adminHeading}`}>
          <TimesheetWeekLabel
            weekTitle={weekTitle}
            weekRangeLabel={weekRangeLabel}
            titleClassName={`font-semibold ${adminHeading}`}
            rangeClassName={`text-xs ${adminTextMuted}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {visibleCards.map((card) => (
          <KpiCard key={card.key} card={card} stats={stats} />
        ))}
      </div>
    </section>
  )
}
