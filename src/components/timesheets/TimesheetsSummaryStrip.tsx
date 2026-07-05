import { TimesheetWeekLabel } from '@/components/timesheets/TimesheetWeekLabel'
import type { TimesheetSummaryStats } from '@/lib/timesheetTypes'
import type { TimesheetStatusFilter } from '@/lib/timesheetUtils'
import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  ClipboardList,
  FilePenLine,
  Send,
  XCircle,
} from 'lucide-react'

type TimesheetsSummaryStripProps = {
  stats: TimesheetSummaryStats
  weekTitle: string
  weekRangeLabel: string
  statusFilter: TimesheetStatusFilter
  onStatusFilterChange: (value: TimesheetStatusFilter) => void
}

type KpiCardConfig = {
  key: string
  title: string
  helper: string
  icon: LucideIcon
  statusFilterValue: TimesheetStatusFilter
  getValue: (stats: TimesheetSummaryStats) => number
  accentBorder: string
  iconWrapClass: string
  iconClass: string
  titleClassName: string
  activeClassName: string
}

const cardBaseBg =
  'bg-gradient-to-br from-[#F5FAFF] to-[#D3E9FC] dark:from-slate-900/70 dark:to-slate-900/70'
const cardIdleBorder = 'border-[#BDDDFB] dark:border-white/10'
const cardHover =
  'hover:-translate-y-0.5 hover:border-[#BFE3F5] hover:from-[#E8F3FE] hover:to-[#D3E9FC] hover:shadow-md hover:shadow-[#BDDDFB]/40 dark:hover:bg-slate-800/80'

const kpiCards: KpiCardConfig[] = [
  {
    key: 'total',
    title: 'Total',
    helper: 'All weekly timesheets',
    icon: ClipboardList,
    statusFilterValue: 'all',
    getValue: (stats) => stats.total,
    accentBorder: 'border-l-[#218EE7]',
    iconWrapClass: 'bg-[#D3E9FC] ring-[#BFE3F5]',
    iconClass: 'text-[#218EE7]',
    titleClassName: 'text-[#0B68BE]',
    activeClassName:
      'border-[#218EE7] from-[#E8F3FE] to-[#D3E9FC] shadow-[0_0_0_1px_rgba(33,142,231,0.35),0_8px_24px_rgba(33,142,231,0.18)] ring-2 ring-[#218EE7]/30',
  },
  {
    key: 'submitted',
    title: 'Submitted',
    helper: 'Waiting for review',
    icon: Send,
    statusFilterValue: 'Submitted',
    getValue: (stats) => stats.pendingApproval,
    accentBorder: 'border-l-[#218EE7]',
    iconWrapClass: 'bg-[#D3E9FC] ring-[#BFE3F5]',
    iconClass: 'text-[#218EE7]',
    titleClassName: 'text-[#0B68BE]',
    activeClassName:
      'border-[#218EE7] from-[#E8F3FE] to-[#D3E9FC] shadow-[0_0_0_1px_rgba(33,142,231,0.35),0_8px_24px_rgba(33,142,231,0.18)] ring-2 ring-[#218EE7]/30',
  },
  {
    key: 'drafts',
    title: 'Drafts',
    helper: 'Not submitted yet',
    icon: FilePenLine,
    statusFilterValue: 'Draft',
    getValue: (stats) => stats.drafts,
    accentBorder: 'border-l-amber-400',
    iconWrapClass: 'bg-amber-50 ring-amber-100',
    iconClass: 'text-amber-600',
    titleClassName: 'text-[#0D477F]',
    activeClassName:
      'border-amber-400 from-[#E8F3FE] to-[#D3E9FC] shadow-[0_0_0_1px_rgba(251,191,36,0.45),0_8px_24px_rgba(251,191,36,0.14)] ring-2 ring-amber-400/35',
  },
  {
    key: 'approved',
    title: 'Approved',
    helper: 'Signed off',
    icon: CheckCircle2,
    statusFilterValue: 'Approved',
    getValue: (stats) => stats.approved,
    accentBorder: 'border-l-emerald-500',
    iconWrapClass: 'bg-emerald-50 ring-emerald-100',
    iconClass: 'text-emerald-600',
    titleClassName: 'text-[#0D477F]',
    activeClassName:
      'border-emerald-400 from-[#E8F3FE] to-[#D3E9FC] shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_8px_24px_rgba(16,185,129,0.12)] ring-2 ring-emerald-500/30',
  },
  {
    key: 'rejected',
    title: 'Rejected',
    helper: 'Needs correction',
    icon: XCircle,
    statusFilterValue: 'Rejected',
    getValue: (stats) => stats.rejected,
    accentBorder: 'border-l-red-500',
    iconWrapClass: 'bg-red-50 ring-red-100',
    iconClass: 'text-red-600',
    titleClassName: 'text-[#0D477F]',
    activeClassName:
      'border-red-400 from-[#E8F3FE] to-[#D3E9FC] shadow-[0_0_0_1px_rgba(239,68,68,0.35),0_8px_24px_rgba(239,68,68,0.12)] ring-2 ring-red-500/30',
  },
]

function KpiCard({
  card,
  stats,
  isActive,
  onSelect,
}: {
  card: KpiCardConfig
  stats: TimesheetSummaryStats
  isActive: boolean
  onSelect: () => void
}) {
  const Icon = card.icon
  const value = card.getValue(stats)
  const isZero = value === 0

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`Filter by ${card.title}: ${value} timesheet${value === 1 ? '' : 's'}`}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-l-4 p-4 text-left shadow-sm shadow-[#BDDDFB]/25 backdrop-blur-xl transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7] focus-visible:ring-offset-2 dark:shadow-none dark:focus-visible:ring-offset-slate-950 ${cardBaseBg} ${card.accentBorder} ${
        isActive ? card.activeClassName : `${cardIdleBorder} ${cardHover}`
      } ${isZero && !isActive ? 'opacity-75 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${card.iconWrapClass} dark:bg-slate-800/70 dark:ring-white/10`}
        >
          <Icon className={`size-5 ${card.iconClass} dark:text-slate-200`} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold leading-none tracking-[-0.04em] text-[#113C69] dark:text-slate-50 sm:text-4xl">
            {value}
          </p>
          <p className={`mt-2.5 text-sm font-semibold dark:text-slate-200 ${card.titleClassName}`}>
            {card.title}
          </p>
          <p className="mt-1 text-xs leading-snug text-[#3D7A9C] dark:text-slate-400">
            {card.helper}
          </p>
        </div>
      </div>
    </button>
  )
}

export function TimesheetsSummaryStrip({
  stats,
  weekTitle,
  weekRangeLabel,
  statusFilter,
  onStatusFilterChange,
}: TimesheetsSummaryStripProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3D7A9C] dark:text-slate-400">
          Week summary
        </p>
        <div className="text-left sm:text-right">
          <TimesheetWeekLabel
            weekTitle={weekTitle}
            weekRangeLabel={weekRangeLabel}
            titleClassName="text-sm font-semibold text-[#113C69] dark:text-slate-100"
            rangeClassName="text-xs text-[#3D7A9C] dark:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.key}
            card={card}
            stats={stats}
            isActive={statusFilter === card.statusFilterValue}
            onSelect={() => onStatusFilterChange(card.statusFilterValue)}
          />
        ))}
      </div>
    </section>
  )
}
