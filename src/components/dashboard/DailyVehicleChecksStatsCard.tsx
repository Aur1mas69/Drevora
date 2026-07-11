import { dashboardOverviewCardClass } from '@/components/dashboard/dashboardOverviewCardStyles'
import type { DashboardDailyVehicleChecksStats } from '@/services/dashboardService'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

type DailyChecksStatRow = {
  key: string
  label: string
  helper: string
  value: number
  icon: LucideIcon
  iconWrapClass: string
  iconClass: string
  barClass: string
}

function buildDailyChecksStatRows(
  stats: DashboardDailyVehicleChecksStats,
): DailyChecksStatRow[] {
  return [
    {
      key: 'completed-ok',
      label: 'Completed OK',
      helper: 'Checks passed today',
      value: stats.completedOk,
      icon: ShieldCheck,
      iconWrapClass: 'bg-emerald-50 ring-emerald-100',
      iconClass: 'text-emerald-600',
      barClass: 'bg-gradient-to-r from-[#14A89E] to-[#22C55E]',
    },
    {
      key: 'issues-failed',
      label: 'Issues / Failed',
      helper: 'Needs attention',
      value: stats.issuesFailed,
      icon: AlertTriangle,
      iconWrapClass: 'bg-red-50 ring-red-100',
      iconClass: 'text-red-600',
      barClass: 'bg-gradient-to-r from-[#EF4444] to-[#F87171]',
    },
    {
      key: 'not-checked',
      label: 'Not checked',
      helper: 'Still waiting',
      value: stats.notChecked,
      icon: Clock,
      iconWrapClass: 'bg-amber-50 ring-amber-100',
      iconClass: 'text-amber-600',
      barClass: 'bg-gradient-to-r from-[#F59E0B] to-[#FB923C]',
    },
  ]
}

function DailyChecksStatRowItem({
  row,
  totalVehicles,
}: {
  row: DailyChecksStatRow
  totalVehicles: number
}) {
  const Icon = row.icon
  const widthPercent =
    totalVehicles > 0
      ? Math.max(0, Math.min(100, (row.value / totalVehicles) * 100))
      : 0

  return (
    <li className="rounded-xl border border-[#CFE3F5] bg-[#F8FBFF]/80 px-4 py-3 transition-colors hover:bg-[#DCEEFF]/70">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${row.iconWrapClass}`}
          >
            <Icon className={`size-4 ${row.iconClass}`} strokeWidth={2.1} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#163A63]">{row.label}</p>
            <p className="text-xs text-[#5D7C9D]">{row.helper}</p>
          </div>
        </div>
        <span className="shrink-0 text-2xl font-bold leading-none tabular-nums text-[#163A63]">
          {row.value}
        </span>
      </div>
      <div
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#DCEEFF] ring-1 ring-[#CFE3F5]/80"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${row.barClass}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </li>
  )
}

export function DailyVehicleChecksStatsCard({
  stats,
}: {
  stats: DashboardDailyVehicleChecksStats
}) {
  const { totalVehicles } = stats
  const rows = buildDailyChecksStatRows(stats)

  return (
    <section className={`${dashboardOverviewCardClass} p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#163A63]">
            Daily Vehicle Checks Stats
          </h3>
          <p className="mt-0.5 text-xs text-[#5D7C9D]">Today&apos;s vehicle check overview</p>
        </div>
        <Link
          to="/admin/vehicle-checks"
          className="text-xs font-semibold text-[#3B82F6] hover:underline"
        >
          View
        </Link>
      </div>

      {totalVehicles === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CFE3F5] bg-[#F8FBFF]/80 px-4 py-6 text-center">
          <p className="text-sm font-medium text-[#5D7C9D]">No active vehicles found.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <DailyChecksStatRowItem
                key={row.key}
                row={row}
                totalVehicles={totalVehicles}
              />
            ))}
          </ul>

          <p className="mt-3 text-xs font-medium text-[#5D7C9D]">
            Total vehicles{' '}
            <span className="font-bold tabular-nums text-[#163A63]">{totalVehicles}</span>
          </p>
        </>
      )}
    </section>
  )
}
