import type { DashboardHolidaySummary } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'

type StatusSegment = {
  label: string
  value: number
  color: string
}

const STATUS_COLORS = {
  pending: '#fbbf24',
  approved: '#10b981',
  declined: '#ef4444',
  total: '#3B82F6',
  empty: '#DCEEFF',
} as const

function buildChartSegments(summary: DashboardHolidaySummary): StatusSegment[] {
  return [
    { label: 'Pending', value: summary.pending, color: STATUS_COLORS.pending },
    { label: 'Approved', value: summary.approved, color: STATUS_COLORS.approved },
    { label: 'Declined', value: summary.rejected, color: STATUS_COLORS.declined },
  ]
}

function buildLegendSegments(summary: DashboardHolidaySummary, total: number): StatusSegment[] {
  return [
    ...buildChartSegments(summary),
    { label: 'Total', value: total, color: STATUS_COLORS.total },
  ]
}

function HolidayDonutChart({ segments, total }: { segments: StatusSegment[]; total: number }) {
  const size = 88
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  let accumulated = 0

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={STATUS_COLORS.empty}
          strokeWidth={strokeWidth}
        />
        {total > 0
          ? segments.map((segment) => {
              if (segment.value === 0) return null

              const segmentLength = (segment.value / total) * circumference
              const offset = accumulated
              accumulated += segmentLength

              return (
                <circle
                  key={segment.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={-offset}
                />
              )
            })
          : null}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none tabular-nums text-[#163A63] dark:text-slate-100">{total}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5D7C9D] dark:text-slate-400">
          Total
        </span>
      </div>
    </div>
  )
}

function StatusLegend({ segments }: { segments: StatusSegment[] }) {
  return (
    <ul className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1.5">
      {segments.map((segment) => (
        <li key={segment.label} className="flex items-center justify-between gap-3 text-xs">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="truncate font-medium text-[#163A63] dark:text-slate-100">{segment.label}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-[#3B82F6] dark:text-blue-300">{segment.value}</span>
        </li>
      ))}
    </ul>
  )
}

export function HolidayRequestsOverviewCard({
  summary,
}: {
  summary: DashboardHolidaySummary
}) {
  const chartSegments = buildChartSegments(summary)
  const total = summary.pending + summary.approved + summary.rejected
  const legendSegments = buildLegendSegments(summary, total)

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Holiday Requests"
        subtitle="Current overview"
        actionTo="/admin/holidays"
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <HolidayDonutChart segments={chartSegments} total={total} />
        <StatusLegend segments={legendSegments} />
      </div>
    </section>
  )
}
