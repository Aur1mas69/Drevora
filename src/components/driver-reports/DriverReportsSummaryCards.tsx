import { driverReportKpiVisualStyles } from '@/components/driver-reports/driverReportKpiStyles'
import type { DriverReportKpiFilter, DriverReportSummaryStats } from '@/lib/driverReportTypes'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Clock3, Inbox } from 'lucide-react'

type DriverReportsSummaryCardsProps = {
  stats: DriverReportSummaryStats
  activeFilter: DriverReportKpiFilter
  onFilterChange: (filter: DriverReportKpiFilter) => void
}

type KpiCardConfig = {
  key: Exclude<DriverReportKpiFilter, 'all'>
  title: string
  helper: string
  icon: LucideIcon
  getValue: (stats: DriverReportSummaryStats) => number
}

const kpiCards: KpiCardConfig[] = [
  {
    key: 'new',
    title: 'New Reports',
    helper: 'Awaiting office review',
    icon: Inbox,
    getValue: (stats) => stats.newReports,
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    helper: 'Being handled by office',
    icon: Clock3,
    getValue: (stats) => stats.inProgress,
  },
  {
    key: 'closed',
    title: 'Closed',
    helper: 'Resolved and archived',
    icon: CheckCircle2,
    getValue: (stats) => stats.closed,
  },
  {
    key: 'critical_high',
    title: 'Critical / High Priority',
    helper: 'Needs urgent attention',
    icon: AlertTriangle,
    getValue: (stats) => stats.criticalHigh,
  },
]

function KpiCard({
  card,
  stats,
  isActive,
  onSelect,
}: {
  card: KpiCardConfig
  stats: DriverReportSummaryStats
  isActive: boolean
  onSelect: () => void
}) {
  const Icon = card.icon
  const value = card.getValue(stats)
  const style = driverReportKpiVisualStyles[card.key]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={`Filter by ${card.title}: ${value}`}
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

export function DriverReportsSummaryCards({
  stats,
  activeFilter,
  onFilterChange,
}: DriverReportsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpiCards.map((card) => (
        <KpiCard
          key={card.key}
          card={card}
          stats={stats}
          isActive={activeFilter === card.key}
          onSelect={() =>
            onFilterChange(activeFilter === card.key ? 'all' : card.key)
          }
        />
      ))}
    </div>
  )
}
