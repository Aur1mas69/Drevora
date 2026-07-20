import {
  RowActionsMenu,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import { VehicleCardNextEvent } from '@/components/vehicles/VehicleCardNextEvent'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import {
  resolveVehicleCardAccent,
  vehicleCardIconClass,
  vehicleCardMetaLabelClass,
  vehicleCardShellClass,
  vehicleCardTopAccentClass,
} from '@/components/vehicles/vehicleCardAccentStyles'
import {
  formatVehicleCardEventTiming,
  getVehicleCardNextEvent,
} from '@/lib/vehicleCardNextEvent'
import { getDriverLabel } from '@/lib/vehiclePageUtils'
import type { Driver } from '@/services/driversService'
import {
  getVehicleStatusForDate,
  type Vehicle,
} from '@/services/vehiclesService'
import { Droplets, Eye, Pencil, Trash2, Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type VehicleCardProps = {
  vehicle: Vehicle
  drivers: Driver[]
  onEdit: (vehicle: Vehicle) => void
  onArchive: (vehicle: Vehicle) => void
}

function registrationLabel(vehicle: Vehicle): string {
  return vehicle.registration?.trim() || 'No registration'
}

function makeModelLabel(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim() || 'Unknown vehicle'
}

export function VehicleCard({
  vehicle,
  drivers,
  onEdit,
  onArchive,
}: VehicleCardProps) {
  const navigate = useNavigate()
  const profilePath = `/vehicles/${vehicle.id}`
  const registration = registrationLabel(vehicle)
  const makeModel = makeModelLabel(vehicle)
  const status = getVehicleStatusForDate(vehicle)
  const assignedWorker = getDriverLabel(vehicle, drivers)
  const assignedDisplay =
    assignedWorker === 'Unassigned' ? 'Not assigned' : assignedWorker
  const trailer = vehicle.trailerNumber?.trim() || ''
  const nextEvent = getVehicleCardNextEvent(vehicle)
  const accent = resolveVehicleCardAccent(
    status,
    nextEvent.nearest?.urgency ?? null,
  )
  const metaLabelClass = vehicleCardMetaLabelClass[accent]
  const nextEventSummary = nextEvent.nearest
    ? `${nextEvent.nearest.label}, ${formatVehicleCardEventTiming(nextEvent.nearest)}`
    : 'No upcoming events'

  const actions: RowAction[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      to: profilePath,
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => onEdit(vehicle),
    },
    {
      id: 'consumables',
      label: 'View consumables',
      icon: Droplets,
      to: `${profilePath}?tab=consumables`,
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Trash2,
      tone: 'danger',
      onClick: () => onArchive(vehicle),
    },
  ]

  function openProfile() {
    navigate(profilePath)
  }

  return (
    <article
      className={`group relative flex h-full min-h-[176px] flex-col overflow-hidden rounded-xl p-2.5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-[#3B82F6]/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${vehicleCardShellClass[accent]}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${vehicleCardTopAccentClass[accent]}`}
      />

      <div className="relative flex items-start justify-between gap-1.5">
        <button
          type="button"
          onClick={openProfile}
          className={`flex size-11 items-center justify-center rounded-full ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/45 ${vehicleCardIconClass[accent]}`}
          aria-label={`View vehicle profile for ${registration}`}
        >
          <Truck className="size-5" aria-hidden="true" />
        </button>

        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <RowActionsMenu actions={actions} appearance="workers" align="end" />
        </div>
      </div>

      <button
        type="button"
        onClick={openProfile}
        className="relative mt-2 flex min-w-0 flex-1 flex-col items-stretch rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40"
        aria-label={`${registration}, ${makeModel}, ${vehicle.vehicleType ?? 'Vehicle'}, ${status}, assigned ${assignedDisplay}, next event ${nextEventSummary}`}
      >
        <p
          className="truncate text-[13px] font-semibold leading-snug tracking-[-0.02em] text-[#113C69] transition-colors group-hover:text-[#0B68BE] dark:text-slate-100 dark:group-hover:text-blue-300"
          title={registration}
        >
          {registration}
        </p>

        <p
          className="mt-1 truncate text-[11px] font-medium text-[#3D7A9C] dark:text-slate-300"
          title={makeModel}
        >
          {makeModel}
        </p>

        <p className="mt-0.5 truncate text-[11px] font-semibold text-[#0B68BE]/90 dark:text-blue-300/90">
          {vehicle.vehicleType?.trim() || 'No type'}
        </p>

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <VehicleStatusBadge status={status} />

          <p
            className="truncate text-[11px] font-medium text-[#113C69] dark:text-slate-200"
            title={assignedDisplay}
          >
            <span className={metaLabelClass}>Worker: </span>
            {assignedDisplay}
          </p>

          {trailer ? (
            <p
              className="truncate text-[11px] font-medium text-[#113C69] dark:text-slate-200"
              title={trailer}
            >
              <span className={metaLabelClass}>Trailer: </span>
              {trailer}
            </p>
          ) : null}
        </div>
      </button>

      <div className="relative mt-1.5">
        <VehicleCardNextEvent
          vehicle={vehicle}
          accent={accent}
          onOpenMore={openProfile}
        />
      </div>
    </article>
  )
}
