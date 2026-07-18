import { TimesheetWeekLabel } from '@/components/timesheets/TimesheetWeekLabel'
import { timesheetKpiVisualStyles } from '@/components/timesheets/timesheetSummaryKpiStyles'
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
  style: (typeof timesheetKpiVisualStyles)[keyof typeof timesheetKpiVisualStyles]
}

const kpiCards: KpiCardConfig[] = [
  {
    key: 'total',
    title: 'Total',
    helper: 'All weekly timesheets',
    icon: ClipboardList,
    statusFilterValue: 'all',
    getValue: (stats) => stats.total,
    style: timesheetKpiVisualStyles.total,
  },
  {
    key: 'submitted',
    title: 'Submitted',
    helper: 'Waiting for review',
    icon: Send,
    statusFilterValue: 'Submitted',
    getValue: (stats) => stats.pendingApproval,
    style: timesheetKpiVisualStyles.submitted,
  },
  {
    key: 'drafts',
    title: 'Drafts',
    helper: 'Not submitted yet',
    icon: FilePenLine,
    statusFilterValue: 'Draft',
    getValue: (stats) => stats.drafts,
    style: timesheetKpiVisualStyles.drafts,
  },
  {
    key: 'approved',
    title: 'Approved',
    helper: 'Signed off',
    icon: CheckCircle2,
    statusFilterValue: 'Approved',
    getValue: (stats) => stats.approved,
    style: timesheetKpiVisualStyles.approved,
  },
  {
    key: 'rejected',
    title: 'Rejected',
    helper: 'Needs correction',
    icon: XCircle,
    statusFilterValue: 'Rejected',
    getValue: (stats) => stats.rejected,
    style: timesheetKpiVisualStyles.rejected,
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
  const { style } = card

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`Filter by ${card.title}: ${value} timesheet${value === 1 ? '' : 's'}`}
      className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-l-4 p-4 text-left transition-all duration-[180ms] ease-out hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:-translate-y-px active:scale-[0.99] ${style.baseGradient} ${style.baseBorder} ${style.leftBorder} ${style.baseShadow} ${style.hoverGradient} ${style.hoverBorder} ${style.hoverShadow} ${style.activeGradient} ${style.activeBorder} ${style.activeShadow} ${style.focusRing} ${
        isActive ? `${style.selectedRing} ${style.selectedShadow}` : ''
      }`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-35 blur-2xl transition-opacity duration-200 group-hover:opacity-50 ${style.glowClass}`}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3.5">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200 group-hover:brightness-[1.03] ${style.iconWrap}`}
        >
          <Icon className={`size-5 ${style.iconClass}`} strokeWidth={2.1} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-3xl font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-4xl ${style.valueClass}`}
          >
            {value}
          </p>
          <p className={`mt-2.5 text-sm font-semibold ${style.labelClass}`}>{card.title}</p>
          <p className={`mt-1 text-xs leading-snug ${style.subtitleClass}`}>{card.helper}</p>
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
