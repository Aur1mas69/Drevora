import type { DashboardFleetStatus } from '@/services/dashboardService'
import {
  dashboardOverviewCardClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Truck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'

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
      iconWrapClass: 'bg-emerald-50 ring-emerald-100',
      iconClass: 'text-emerald-600',
    },
    {
      key: 'off-road',
      label: 'Off road',
      helper: 'Needs attention',
      value: fleetStatus.offRoad,
      icon: AlertTriangle,
      iconWrapClass: 'bg-red-50 ring-red-100',
      iconClass: 'text-red-600',
    },
    {
      key: 'maintenance-due',
      label: 'Maintenance due',
      helper: 'Scheduled / due soon',
      value: fleetStatus.maintenanceDue,
      icon: Wrench,
      iconWrapClass: 'bg-amber-50 ring-amber-100',
      iconClass: 'text-amber-600',
    },
  ]
}

function FleetStatusRowItem({ row }: { row: FleetStatusRow }) {
  const Icon = row.icon

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[#CFE3F5] bg-[#F8FBFF]/80 px-4 py-3 transition-colors hover:bg-[#DCEEFF]/70">
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
    <section className={`${dashboardOverviewCardClass} p-5`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-[#163A63]">Fleet Status</h3>
          <p className="mt-0.5 text-xs text-[#5D7C9D]">Current fleet availability</p>
        </div>
        <Link to="/vehicles" className="text-xs font-semibold text-[#3B82F6] hover:underline">
          View
        </Link>
      </div>

      <ul className="space-y-2.5">
        {rows.map((row) => (
          <FleetStatusRowItem key={row.key} row={row} />
        ))}
      </ul>
    </section>
  )
}
