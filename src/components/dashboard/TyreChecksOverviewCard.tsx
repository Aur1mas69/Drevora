import {
  dashboardOverviewCardClass,
  dashboardOverviewInnerRowClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import type { DashboardDailyTyreChecksStats } from '@/services/dashboardService'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CircleDot, Clock, ShieldCheck } from 'lucide-react'

type TyreChecksStatRow = {
  key: string
  label: string
  helper: string
  value: number
  icon: LucideIcon
  iconWrapClass: string
  iconClass: string
  barClass: string
}

function buildTyreChecksStatRows(stats: DashboardDailyTyreChecksStats): TyreChecksStatRow[] {
  return [
    {
      key: 'completed-ok',
      label: 'Completed OK',
      helper: 'No tyre issues today',
      value: stats.completedOk,
      icon: ShieldCheck,
      iconWrapClass:
        'bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-800/50',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      barClass: 'bg-gradient-to-r from-[#14A89E] to-[#22C55E]',
    },
    {
      key: 'issues-found',
      label: 'Issues Found',
      helper: 'Defects or failed positions',
      value: stats.issuesFound,
      icon: AlertTriangle,
      iconWrapClass: 'bg-red-50 ring-red-100 dark:bg-red-950/40 dark:ring-red-800/50',
      iconClass: 'text-red-600 dark:text-red-400',
      barClass: 'bg-gradient-to-r from-[#EF4444] to-[#F87171]',
    },
    {
      key: 'not-checked',
      label: 'Not Checked',
      helper: 'Still waiting today',
      value: stats.notChecked,
      icon: Clock,
      iconWrapClass: 'bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/50',
      iconClass: 'text-amber-600 dark:text-amber-400',
      barClass: 'bg-gradient-to-r from-[#F59E0B] to-[#FB923C]',
    },
  ]
}

function TyreChecksStatRowItem({
  row,
  totalVehicles,
}: {
  row: TyreChecksStatRow
  totalVehicles: number
}) {
  const Icon = row.icon
  const widthPercent =
    totalVehicles > 0
      ? Math.max(0, Math.min(100, (row.value / totalVehicles) * 100))
      : 0

  return (
    <li className={dashboardOverviewInnerRowClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${row.iconWrapClass}`}
          >
            <Icon className={`size-4 ${row.iconClass}`} strokeWidth={2.1} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#163A63] dark:text-slate-100">{row.label}</p>
            <p className="text-xs text-[#5D7C9D] dark:text-slate-400">{row.helper}</p>
          </div>
        </div>
        <span className="shrink-0 text-2xl font-bold leading-none tabular-nums text-[#163A63] dark:text-slate-100">
          {row.value}
        </span>
      </div>
      <div
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#E8E0F5] ring-1 ring-[#D8CEF0]/80 dark:bg-slate-700 dark:ring-white/10"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${row.barClass}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </li>
  )
}

export function TyreChecksOverviewCard({
  stats,
}: {
  stats: DashboardDailyTyreChecksStats
}) {
  const { totalVehicles } = stats
  const rows = buildTyreChecksStatRows(stats)

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Tyre Checks"
        subtitle="Today's tyre inspection overview"
        actionTo="/admin/vehicle-checks"
        actionLabel="View"
        leading={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#D8CEF0] bg-[#EEE7FA] text-[#7C3AED] dark:border-white/10 dark:bg-violet-950/50 dark:text-violet-300">
            <CircleDot className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </div>
        }
      />

      {totalVehicles === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D8CEF0] bg-[#F8F5FF]/80 px-4 py-6 text-center dark:border-white/10 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-[#5D7C9D] dark:text-slate-400">
            No active vehicles found.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-auto space-y-2.5" aria-label="Tyre check status today">
            {rows.map((row) => (
              <TyreChecksStatRowItem key={row.key} row={row} totalVehicles={totalVehicles} />
            ))}
          </ul>

          <p className="mt-3 text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
            Total vehicles{' '}
            <span className="font-bold tabular-nums text-[#163A63] dark:text-slate-100">
              {totalVehicles}
            </span>
          </p>
        </>
      )}
    </section>
  )
}
