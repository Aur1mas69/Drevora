import type { DashboardTimesheetOverview } from '@/services/dashboardService'
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
  draft: '#fbbf24',
  submitted: '#3B82F6',
  approved: '#10b981',
  rejected: '#ef4444',
  empty: '#DCEEFF',
} as const

function buildSegments(overview: DashboardTimesheetOverview): StatusSegment[] {
  return [
    { label: 'Draft', value: overview.drafts, color: STATUS_COLORS.draft },
    { label: 'Submitted', value: overview.submitted, color: STATUS_COLORS.submitted },
    { label: 'Approved', value: overview.approved, color: STATUS_COLORS.approved },
    { label: 'Rejected', value: overview.rejected, color: STATUS_COLORS.rejected },
  ]
}

function TimesheetDonutChart({ segments, total }: { segments: StatusSegment[]; total: number }) {
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

export function TimesheetOverviewCard({
  overview,
}: {
  overview: DashboardTimesheetOverview
}) {
  const segments = buildSegments(overview)
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Timesheet Overview"
        subtitle="Current week"
        actionTo="/admin/timesheets"
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <TimesheetDonutChart segments={segments} total={total} />
        <StatusLegend segments={segments} />
      </div>
    </section>
  )
}
