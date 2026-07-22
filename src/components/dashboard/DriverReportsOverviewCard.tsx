import type { DashboardDriverReportsSummary } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
  dashboardOverviewInnerRowClass,
  dashboardOverviewPrimaryValueClass,
  dashboardOverviewRowHelperClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import { FileText } from 'lucide-react'

type StatusRow = {
  label: string
  value: number
  valueClassName: string
}

function buildStatusRows(summary: DashboardDriverReportsSummary): StatusRow[] {
  return [
    {
      label: 'New Reports',
      value: summary.open,
      valueClassName: 'text-[#3B82F6] dark:text-blue-300',
    },
    {
      label: 'In Progress',
      value: summary.inProgress,
      valueClassName: 'text-amber-500 dark:text-amber-400',
    },
    {
      label: 'Closed',
      value: summary.closed,
      valueClassName: 'text-emerald-600 dark:text-emerald-400',
    },
  ]
}

function ReportIllustration() {
  return (
    <div
      className="relative mx-auto flex size-[6.5rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DCEEFF] to-[#F4F9FF] shadow-[0_4px_14px_rgba(59,130,246,0.12)] ring-1 ring-[#CFE3F5]/80 dark:from-slate-800 dark:to-slate-900 dark:ring-white/10 sm:mx-0 sm:size-28"
      aria-hidden="true"
    >
      <div className="absolute inset-3 rounded-xl bg-white/50 dark:bg-slate-700/45" />
      <FileText className="relative size-10 text-[#3B82F6]/75 dark:text-blue-300/70 sm:size-11" strokeWidth={1.6} />
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col gap-1">
        <span className="block h-0.5 w-9 rounded-full bg-[#CFE3F5]" />
        <span className="block h-0.5 w-7 rounded-full bg-[#CFE3F5]" />
        <span className="block h-0.5 w-8 rounded-full bg-[#CFE3F5]" />
      </div>
      <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#3B82F6] shadow-sm ring-2 ring-white dark:ring-slate-900">
        <span className="size-2 rounded-full bg-white/90 dark:bg-slate-200/90" />
      </span>
    </div>
  )
}

export function DriverReportsOverviewCard({
  summary,
}: {
  summary: DashboardDriverReportsSummary
}) {
  const statusRows = buildStatusRows(summary)

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Driver Reports"
        subtitle="Open issues and progress"
        actionLabel="View all"
        actionTo="/admin/driver-reports"
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
        <ul className="flex w-full min-w-0 flex-1 flex-col justify-center gap-2">
          {statusRows.map((row) => (
            <li
              key={row.label}
              className={`flex items-center justify-between gap-3 ${dashboardOverviewInnerRowClass}`}
            >
              <span className={dashboardOverviewRowHelperClass}>{row.label}</span>
              <span className={`${dashboardOverviewPrimaryValueClass} ${row.valueClassName}`}>
                {row.value}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center justify-center sm:pl-1">
          <ReportIllustration />
        </div>
      </div>
    </section>
  )
}
