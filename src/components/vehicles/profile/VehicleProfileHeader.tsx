import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import { getVehicleStatusForDate, type Vehicle } from '@/services/vehiclesService'

type VehicleProfileHeaderProps = {
  vehicle: Vehicle
  assignedWorkerLabel: string
  onEdit: () => void
  onDelete: () => void
  isDeleting?: boolean
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

export function VehicleProfileHeader({
  vehicle,
  assignedWorkerLabel,
  onEdit,
  onDelete,
  isDeleting = false,
}: VehicleProfileHeaderProps) {
  return (
    <header className="space-y-3">
      <Button
        asChild
        variant="ghost"
        className="h-9 rounded-[12px] px-3 text-sm font-semibold text-[#5499BF] hover:bg-[#EEF6FF]/80 hover:text-[#0B68BE] dark:hover:bg-slate-800/50"
      >
        <Link to="/vehicles">
          <ArrowLeft className="size-4" />
          Back to Vehicles
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F3FE]/90 text-[#218EE7] ring-1 ring-[#C5DFFB]/80 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-400/30 sm:size-14">
            <Truck className="size-6 sm:size-7" strokeWidth={1.9} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#113C69] dark:text-slate-100 sm:text-3xl">
                {vehicle.registration}
              </h1>
              <VehicleStatusBadge status={getVehicleStatusForDate(vehicle)} />
            </div>
            <p className="mt-1 text-base font-medium text-[#3D7A9C] dark:text-slate-300">
              {getVehicleName(vehicle) || 'Make / model not set'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {vehicle.fleetNumber ? (
                <span className="inline-flex rounded-md bg-[#E8F3FE]/90 px-2.5 py-1 text-xs font-bold tabular-nums text-[#0B68BE] ring-1 ring-[#C5DFFB] dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-400/30">
                  Fleet {vehicle.fleetNumber}
                </span>
              ) : null}
              {vehicle.vehicleType ? (
                <span className="inline-flex rounded-full bg-[#EEF6FF]/70 px-2.5 py-1 text-xs font-semibold text-[#3D7A9C] ring-1 ring-[#D3E9FC] dark:bg-slate-800/60 dark:text-slate-300 dark:ring-white/10">
                  {vehicle.vehicleType}
                </span>
              ) : null}
              <span className="inline-flex rounded-full bg-[#EEF6FF]/70 px-2.5 py-1 text-xs font-semibold text-[#3D7A9C] ring-1 ring-[#D3E9FC] dark:bg-slate-800/60 dark:text-slate-300 dark:ring-white/10">
                {assignedWorkerLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center lg:w-auto">
          <Button
            type="button"
            onClick={onEdit}
            className="h-10 w-full rounded-[12px] bg-[#218EE7] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(33,142,231,0.22)] hover:bg-[#0B68BE] min-[400px]:w-auto"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit Vehicle
          </Button>
          <Button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            variant="outline"
            className="h-10 w-full rounded-[12px] border-rose-200 bg-rose-50/70 px-4 text-sm font-semibold text-rose-700 shadow-none hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50 min-[400px]:w-auto"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete Vehicle
          </Button>
        </div>
      </div>
    </header>
  )
}
