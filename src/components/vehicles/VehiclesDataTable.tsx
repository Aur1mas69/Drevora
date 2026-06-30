import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
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
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import { Button } from '@/components/ui/button'
import type { Driver } from '@/services/driversService'
import {
  getVehicleStatusForDate,
  type Vehicle,
} from '@/services/vehiclesService'
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from 'lucide-react'

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

function DocumentDateCell({ expiry }: { expiry: string | null }) {
  const status = getDocumentStatus(expiry)

  const toneClass =
    status === 'expired'
      ? 'text-rose-700'
      : status === 'warning'
        ? 'text-amber-700'
        : 'text-slate-700'

  return (
    <span className={`whitespace-nowrap text-sm font-medium ${toneClass}`}>
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
    return <span className="text-sm text-slate-400">None scheduled</span>
  }

  const daysUntil = getDaysUntilDate(nextEvent.startDate)
  const colorClass = getPlanningEventColor(nextEvent)

  return (
    <button
      type="button"
      onClick={() => onOpenEvent(vehicle, nextEvent)}
      className="text-left transition-opacity hover:opacity-80"
    >
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold text-white ${colorClass}`}
      >
        {nextEvent.label === 'Off Road' ? 'OFF ROAD' : nextEvent.label}
      </span>
      <p className="mt-1 text-xs font-medium text-slate-600">
        {formatShortDate(nextEvent.startDate)}
      </p>
      <p className="text-[11px] font-medium text-[#2563EB]">
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
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    },
  ]

  return <RowActionsMenu actions={actions} />
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
  const total = vehicles.length
  const totalPages = Math.max(1, Math.ceil(total / VEHICLES_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * VEHICLES_PAGE_SIZE
  const pageVehicles = vehicles.slice(startIndex, startIndex + VEHICLES_PAGE_SIZE)
  const rangeStart = total === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + VEHICLES_PAGE_SIZE, total)

  return (
    <div className="overflow-hidden rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_4px_16px_rgba(40,80,140,0.05)]">
      <div className="max-h-[min(720px,70vh)] overflow-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#F4F8FF] shadow-[0_1px_0_rgba(75,120,220,0.10)]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              <th className="px-4 py-3.5">Registration</th>
              <th className="px-4 py-3.5">Fleet #</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5">Make / Model</th>
              <th className="px-4 py-3.5">Assigned Driver</th>
              <th className="px-4 py-3.5">Current Status</th>
              <th className="px-4 py-3.5">Next Event</th>
              <th className="px-4 py-3.5">MOT Expiry</th>
              <th className="px-4 py-3.5">Insurance Expiry</th>
              <TableActionsHeader className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {pageVehicles.map((vehicle) => (
              <tr
                key={vehicle.id}
                className="border-t border-[rgba(70,110,220,0.06)] transition-colors hover:bg-[#F8FBFF]"
              >
                <td className="px-4 py-3.5">
                  <span className="text-sm font-semibold text-[#2A376F]">
                    {vehicle.registration}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-sm font-medium tabular-nums text-slate-700">
                  {vehicle.fleetNumber ?? '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-slate-600">
                  {vehicle.vehicleType ?? '—'}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3.5 text-sm text-slate-600">
                  {getVehicleName(vehicle)}
                </td>
                <td className="max-w-[160px] truncate px-4 py-3.5 text-sm text-slate-600">
                  {getDriverLabel(vehicle, drivers)}
                </td>
                <td className="px-4 py-3.5">
                  <VehicleStatusBadge status={getVehicleStatusForDate(vehicle)} />
                </td>
                <td className="px-4 py-3.5">
                  <NextEventCell
                    vehicle={vehicle}
                    onOpenEvent={onOpenAvailabilityEvent}
                  />
                </td>
                <td className="px-4 py-3.5">
                  <DocumentDateCell expiry={vehicle.motExpiry} />
                </td>
                <td className="px-4 py-3.5">
                  <DocumentDateCell expiry={vehicle.insuranceExpiry} />
                </td>
                <TableActionsCell className="px-4 py-3.5">
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

      <div className="flex flex-col gap-3 border-t border-[rgba(70,110,220,0.08)] bg-[#FAFCFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-600">
          Showing {rangeStart}–{rangeEnd} of {total} vehicle{total === 1 ? '' : 's'}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="h-8 rounded-[10px] border-[rgba(75,120,220,0.12)] px-2.5"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="px-2 text-sm font-medium text-slate-600">
            Page {safePage} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="h-8 rounded-[10px] border-[rgba(75,120,220,0.12)] px-2.5"
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
    <div className="overflow-hidden rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-white p-4 shadow-[0_4px_16px_rgba(40,80,140,0.05)]">
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-[10px] bg-[#EEF4FF]"
          />
        ))}
      </div>
    </div>
  )
}
