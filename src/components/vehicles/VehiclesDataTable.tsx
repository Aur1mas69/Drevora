import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import {
  vehicleTableFooterClass,
  vehicleTableHeadClass,
  vehicleTableRowClass,
  vehicleTableShellClass,
} from '@/components/vehicles/vehicleUiStyles'
import { Button } from '@/components/ui/button'
import { adminBadgeDark, adminTableEntityName } from '@/lib/adminUiStyles'
import {
  formatShortDate,
  formatStartsInText,
  getDaysUntilDate,
} from '@/lib/vehicleAvailability'
import { getDocumentStatus, getDriverLabel } from '@/lib/vehiclePageUtils'
import {
  getNextPlanningEvent,
  getPlanningEventColor,
  type PlanningEvent,
} from '@/lib/vehiclePlanning'
import type { Driver } from '@/services/driversService'
import {
  getVehicleStatusForDate,
  type Vehicle,
} from '@/services/vehiclesService'
import { ChevronLeft, ChevronRight, Droplets, Eye, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export const VEHICLES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export const VEHICLES_PAGE_SIZE = 25

function formatDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

function FleetNumberBadge({ fleetNumber }: { fleetNumber: string | null }) {
  if (!fleetNumber) {
    return <span className="text-xs font-medium text-[#5499BF]/70 dark:text-slate-500">—</span>
  }

  return (
    <span
      className={`inline-flex rounded-md bg-[#EEF6FF] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#0B68BE] ring-1 ring-[#C5DFFB] ${adminBadgeDark.blue}`}
    >
      {fleetNumber}
    </span>
  )
}

function VehicleTypeBadge({ vehicleType }: { vehicleType: string | null }) {
  if (!vehicleType) {
    return <span className="text-xs font-medium text-[#5499BF]/70 dark:text-slate-500">—</span>
  }

  return (
    <span
      className={`inline-flex rounded-full bg-[#F5FAFF] px-2.5 py-0.5 text-[11px] font-semibold text-[#5499BF] ring-1 ring-[#D3E9FC] ${adminBadgeDark.softBlue}`}
    >
      {vehicleType}
    </span>
  )
}

function DocumentExpiryBadge({ expiry }: { expiry: string | null }) {
  const status = getDocumentStatus(expiry)

  const toneClass =
    status === 'expired'
      ? `bg-rose-50 text-rose-700 ring-rose-200 ${adminBadgeDark.rose}`
      : status === 'warning'
        ? `bg-amber-50 text-amber-800 ring-amber-200 ${adminBadgeDark.amber}`
        : status === 'valid'
          ? `bg-[#EEF6FF] text-[#0B68BE] ring-[#C5DFFB] ${adminBadgeDark.blue}`
          : `bg-slate-50 text-slate-500 ring-slate-200 ${adminBadgeDark.muted}`

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${toneClass}`}
    >
      {formatDate(expiry)}
    </span>
  )
}

function NextEventCell({
  vehicle,
  onOpenEvent,
}: {
  vehicle: Vehicle
  onOpenEvent: (vehicle: Vehicle, event: PlanningEvent) => void
}) {
  const nextEvent = getNextPlanningEvent(vehicle)

  if (!nextEvent) {
    return (
      <span className="text-xs font-medium text-[#5499BF]/80 dark:text-slate-500">
        None scheduled
      </span>
    )
  }

  const daysUntil = getDaysUntilDate(nextEvent.startDate)
  const colorClass = getPlanningEventColor(nextEvent)

  return (
    <button
      type="button"
      onClick={() => onOpenEvent(vehicle, nextEvent)}
      className="group max-w-[140px] text-left transition-opacity hover:opacity-90"
    >
      <span
        className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.02em] text-white shadow-sm ${colorClass}`}
      >
        {nextEvent.label === 'Off Road' ? 'OFF ROAD' : nextEvent.label}
      </span>
      <p className="mt-1 truncate text-[11px] font-medium tabular-nums text-[#113C69] dark:text-slate-100">
        {formatShortDate(nextEvent.startDate)}
      </p>
      <p className="truncate text-[10px] font-semibold text-[#218EE7] group-hover:text-[#0B68BE] dark:text-blue-300 dark:group-hover:text-blue-200">
        {formatStartsInText(daysUntil)}
      </p>
    </button>
  )
}

function VehicleRowActions({
  vehicle,
  onEdit,
  onDelete,
}: {
  vehicle: Vehicle
  onEdit: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      to: `/vehicles/${vehicle.id}`,
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: onEdit,
    },
    {
      id: 'consumables',
      label: 'View consumables',
      icon: Droplets,
      to: `/vehicles/${vehicle.id}?tab=consumables`,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    },
  ]

  return <RowActionsMenu actions={actions} appearance="workers" />
}

type VehiclesDataTableProps = {
  vehicles: Vehicle[]
  drivers: Driver[]
  page: number
  onPageChange: (page: number) => void
  onEditVehicle: (vehicle: Vehicle) => void
  onDeleteVehicle: (vehicle: Vehicle) => void
  onOpenAvailabilityEvent: (vehicle: Vehicle, event: PlanningEvent) => void
}

export function VehiclesDataTable({
  vehicles,
  drivers,
  page,
  onPageChange,
  onEditVehicle,
  onDeleteVehicle,
  onOpenAvailabilityEvent,
}: VehiclesDataTableProps) {
  const [pageSize, setPageSize] = useState(VEHICLES_PAGE_SIZE)
  const total = vehicles.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pageVehicles = vehicles.slice(startIndex, startIndex + pageSize)
  const rangeStart = total === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + pageSize, total)

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize)
    onPageChange(1)
  }

  return (
    <div className={vehicleTableShellClass}>
      <div className="max-h-[min(720px,70vh)] overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <thead>
            <tr className={vehicleTableHeadClass}>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Fleet #</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Make / Model</th>
              <th className="px-4 py-3">Assigned Worker</th>
              <th className="px-4 py-3">Current Status</th>
              <th className="px-4 py-3">Next Event</th>
              <th className="px-4 py-3">MOT Expiry</th>
              <th className="px-4 py-3">Insurance Expiry</th>
              <TableActionsHeader className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pageVehicles.map((vehicle) => (
              <tr key={vehicle.id} className={`${vehicleTableRowClass} text-xs`}>
                <td className="px-4 py-3">
                  <Link
                    to={`/vehicles/${vehicle.id}`}
                    className={`${adminTableEntityName} transition-colors hover:text-[#218EE7]`}
                  >
                    {vehicle.registration}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <FleetNumberBadge fleetNumber={vehicle.fleetNumber} />
                </td>
                <td className="px-4 py-3">
                  <VehicleTypeBadge vehicleType={vehicle.vehicleType} />
                </td>
                <td className="max-w-[180px] px-4 py-3">
                  <span className="block truncate text-sm font-medium text-[#113C69]">
                    {getVehicleName(vehicle) || '—'}
                  </span>
                </td>
                <td className="max-w-[160px] px-4 py-3">
                  <span className={`block truncate ${adminTableEntityName}`}>
                    {getDriverLabel(vehicle, drivers)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <VehicleStatusBadge status={getVehicleStatusForDate(vehicle)} />
                </td>
                <td className="px-4 py-3">
                  <NextEventCell
                    vehicle={vehicle}
                    onOpenEvent={onOpenAvailabilityEvent}
                  />
                </td>
                <td className="px-4 py-3">
                  <DocumentExpiryBadge expiry={vehicle.motExpiry} />
                </td>
                <td className="px-4 py-3">
                  <DocumentExpiryBadge expiry={vehicle.insuranceExpiry} />
                </td>
                <TableActionsCell className="px-4 py-3">
                  <VehicleRowActions
                    vehicle={vehicle}
                    onEdit={() => onEditVehicle(vehicle)}
                    onDelete={() => onDeleteVehicle(vehicle)}
                  />
                </TableActionsCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${vehicleTableFooterClass}`}
      >
        <p className="text-sm font-medium text-[#5499BF] dark:text-slate-400">
          Showing {rangeStart}–{rangeEnd} of {total} vehicle{total === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#5499BF] dark:text-slate-400">
            Rows
            <select
              value={pageSize}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              className="h-8 rounded-[10px] border border-[#C5DFFB]/80 bg-white px-2 text-xs font-medium text-[#113C69] focus-visible:border-[#89CFF0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-500/30"
              aria-label="Rows per page"
            >
              {VEHICLES_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="h-8 rounded-[10px] border-[#C5DFFB] px-2.5 text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:text-blue-300 dark:hover:bg-slate-800/50"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="px-2 text-sm font-medium tabular-nums text-[#113C69] dark:text-slate-100">
            Page {safePage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="h-8 rounded-[10px] border-[#C5DFFB] px-2.5 text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:text-blue-300 dark:hover:bg-slate-800/50"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function VehiclesTableSkeleton() {
  return (
    <div className={`${vehicleTableShellClass} p-4`}>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-[10px] bg-[#EEF6FF]/80 dark:bg-slate-800/60"
          />
        ))}
      </div>
    </div>
  )
}
