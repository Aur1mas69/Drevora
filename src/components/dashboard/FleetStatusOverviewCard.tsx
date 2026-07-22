import type { DashboardFleetStatus } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
  dashboardOverviewInnerRowClass,
  dashboardOverviewPrimaryValueClass,
  dashboardOverviewRowHelperClass,
  dashboardOverviewRowLabelClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Truck, Wrench } from 'lucide-react'

type FleetStatusRow = {
  key: string
  label: string
  helper: string
  value: number
  icon: LucideIcon
  iconWrapClass: string
  iconClass: string
}

function buildFleetStatusRows(fleetStatus: DashboardFleetStatus): FleetStatusRow[] {
  return [
    {
      key: 'available',
      label: 'Available',
      helper: 'Ready for work',
      value: fleetStatus.available,
      icon: Truck,
      iconWrapClass: 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-800/50',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'off-road',
      label: 'Off road',
      helper: 'Needs attention',
      value: fleetStatus.offRoad,
      icon: AlertTriangle,
      iconWrapClass: 'bg-red-50 ring-red-100 dark:bg-red-950/40 dark:ring-red-800/50',
      iconClass: 'text-red-600 dark:text-red-400',
    },
    {
      key: 'maintenance-due',
      label: 'Maintenance due',
      helper: 'Scheduled / due soon',
      value: fleetStatus.maintenanceDue,
      icon: Wrench,
      iconWrapClass: 'bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/50',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
  ]
}

function FleetStatusRowItem({ row }: { row: FleetStatusRow }) {
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

export function FleetStatusOverviewCard({
  fleetStatus,
}: {
  fleetStatus: DashboardFleetStatus
}) {
  const rows = buildFleetStatusRows(fleetStatus)

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Fleet Status"
        subtitle="Current fleet availability"
        actionTo="/vehicles"
      />

      <ul className="mt-auto space-y-2">
        {rows.map((row) => (
          <FleetStatusRowItem key={row.key} row={row} />
        ))}
      </ul>
    </section>
  )
}
