import type { DashboardDriverReportsSummary } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

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
      valueClassName: 'text-[#3B82F6]',
    },
    {
      label: 'In Progress',
      value: summary.inProgress,
      valueClassName: 'text-amber-500',
    },
    {
      label: 'Closed',
      value: summary.closed,
      valueClassName: 'text-emerald-500',
    },
  ]
}

function ReportIllustration() {
  return (
    <div
      className="relative mx-auto flex size-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#DCEEFF] to-[#F8FBFF] ring-1 ring-[#CFE3F5]/70 sm:mx-0"
      aria-hidden="true"
    >
      <div className="absolute inset-3 rounded-xl bg-white/45" />
      <FileText className="relative size-11 text-[#3B82F6]/70" strokeWidth={1.6} />
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col gap-1">
        <span className="block h-0.5 w-9 rounded-full bg-[#CFE3F5]" />
        <span className="block h-0.5 w-7 rounded-full bg-[#CFE3F5]" />
        <span className="block h-0.5 w-8 rounded-full bg-[#CFE3F5]" />
      </div>
      <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#3B82F6] shadow-sm ring-2 ring-white">
        <span className="size-2 rounded-full bg-white/90" />
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
    <section className={`${dashboardOverviewCardClass} p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#163A63]">Driver Reports</h3>
        <Link
          to="/admin/driver-reports"
          className="text-xs font-semibold text-[#3B82F6] hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-3">
          {statusRows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-[#5D7C9D]">{row.label}</span>
              <span className={`text-2xl font-bold leading-none tabular-nums ${row.valueClassName}`}>
                {row.value}
              </span>
            </li>
          ))}
        </ul>

        <ReportIllustration />
      </div>
    </section>
  )
}
