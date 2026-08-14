import type { DashboardTrailerStatus } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
  dashboardOverviewInnerRowClass,
  dashboardOverviewPrimaryValueClass,
  dashboardOverviewRowHelperClass,
  dashboardOverviewRowLabelClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Container, Layers, Wrench } from 'lucide-react'

type TrailerStatusRow = {
  key: string
  label: string
  helper: string
  value: number
  icon: LucideIcon
  iconWrapClass: string
  iconClass: string
}

function buildTrailerStatusRows(trailerStatus: DashboardTrailerStatus): TrailerStatusRow[] {
  return [
    {
      key: 'total',
      label: 'Total',
      helper: 'Active trailers',
      value: trailerStatus.total,
      icon: Layers,
      iconWrapClass: 'bg-sky-50 ring-sky-100 dark:bg-sky-950/40 dark:ring-sky-800/50',
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      key: 'available',
      label: 'Available',
      helper: 'Ready for work',
      value: trailerStatus.available,
      icon: Container,
      iconWrapClass: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-800/50',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'off-road',
      label: 'Off road',
      helper: 'Needs attention',
      value: trailerStatus.offRoad,
      icon: AlertTriangle,
      iconWrapClass: 'bg-red-50 ring-red-100 dark:bg-red-950/40 dark:ring-red-800/50',
      iconClass: 'text-red-600 dark:text-red-400',
    },
    {
      key: 'maintenance-due',
      label: 'Maintenance due',
      helper: 'Scheduled / due soon',
      value: trailerStatus.maintenanceDue,
      icon: Wrench,
      iconWrapClass: 'bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/50',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
  ]
}

function TrailerStatusRowItem({ row }: { row: TrailerStatusRow }) {
  const Icon = row.icon

  return (
    <li className={`flex items-center justify-between gap-3 ${dashboardOverviewInnerRowClass}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${row.iconWrapClass}`}
        >
          <Icon className={`size-4 ${row.iconClass}`} strokeWidth={2.1} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={dashboardOverviewRowLabelClass}>{row.label}</p>
          <p className={dashboardOverviewRowHelperClass}>{row.helper}</p>
        </div>
      </div>
      <span className={dashboardOverviewPrimaryValueClass}>{row.value}</span>
    </li>
  )
}

export function TrailersOverviewCard({
  trailerStatus,
}: {
  trailerStatus: DashboardTrailerStatus
}) {
  const rows = buildTrailerStatusRows(trailerStatus)

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Trailers"
        subtitle="Current trailer availability"
        actionTo="/vehicles"
        leading={
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#D0E4F6] bg-[#E8F3FE] text-[#3B82F6] dark:border-white/10 dark:bg-slate-800/60 dark:text-blue-300">
            <Container className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </div>
        }
      />

      <ul className="mt-auto space-y-2">
        {rows.map((row) => (
          <TrailerStatusRowItem key={row.key} row={row} />
        ))}
      </ul>
    </section>
  )
}
