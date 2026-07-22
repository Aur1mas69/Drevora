import type { DashboardTimesheetOverview } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
  dashboardOverviewLegendLabelClass,
  dashboardOverviewLegendListClass,
  dashboardOverviewLegendRowClass,
  dashboardOverviewLegendValueClass,
  dashboardOverviewPrimaryValueClass,
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
  const size = 96
  const strokeWidth = 11
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  let accumulated = 0

  return (
    <div
      className="relative shrink-0 rounded-full bg-[rgba(248,251,255,0.85)] p-1.5 shadow-[0_2px_10px_rgba(30,64,175,0.06)] ring-1 ring-[#D0E4F6]/70 dark:bg-slate-800/40 dark:ring-white/10"
      style={{ width: size + 12, height: size + 12 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
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
                    strokeLinecap="butt"
                  />
                )
              })
            : null}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={dashboardOverviewPrimaryValueClass}>{total}</span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6B8AAB] dark:text-slate-400">
            Total
          </span>
        </div>
      </div>
    </div>
  )
}

function StatusLegend({ segments }: { segments: StatusSegment[] }) {
  return (
    <ul className={dashboardOverviewLegendListClass}>
      {segments.map((segment) => (
        <li key={segment.label} className={dashboardOverviewLegendRowClass}>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.85)]"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className={dashboardOverviewLegendLabelClass}>{segment.label}</span>
          </span>
          <span className={dashboardOverviewLegendValueClass}>{segment.value}</span>
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

      <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:flex-row sm:items-center sm:gap-5">
        <TimesheetDonutChart segments={segments} total={total} />
        <StatusLegend segments={segments} />
      </div>
    </section>
  )
}
