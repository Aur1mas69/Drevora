import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import { vehicleProfilePanelClass } from '@/components/vehicles/profile/vehicleProfileUi'
import { getVehicleStatusForDate, type Vehicle } from '@/services/vehiclesService'

type VehicleProfileHeaderProps = {
  vehicle: Vehicle
  assignedWorkerLabel: string
  onEdit: () => void
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

export function VehicleProfileHeader({
  vehicle,
  assignedWorkerLabel,
  onEdit,
}: VehicleProfileHeaderProps) {
  return (
    <div className={`${vehicleProfilePanelClass} p-5 sm:p-6`}>
      <Button
        asChild
        variant="ghost"
        className="mb-4 h-9 rounded-[12px] px-3 text-sm font-semibold text-[#5499BF] hover:bg-[#EEF6FF] hover:text-[#0B68BE]"
      >
        <Link to="/vehicles">
          <ArrowLeft className="size-4" />
          Back to Vehicles
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#218EE7] ring-1 ring-[#C5DFFB]">
            <Truck className="size-7" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-[-0.04em] text-[#113C69] sm:text-3xl">
                {vehicle.registration}
              </h1>
              <VehicleStatusBadge status={getVehicleStatusForDate(vehicle)} />
            </div>
            <p className="mt-1 text-base font-medium text-[#5499BF]">
              {getVehicleName(vehicle) || 'Make / model not set'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {vehicle.fleetNumber ? (
                <span className="inline-flex rounded-md bg-[#EEF6FF] px-2.5 py-1 text-xs font-bold tabular-nums text-[#0B68BE] ring-1 ring-[#C5DFFB]">
                  Fleet {vehicle.fleetNumber}
                </span>
              ) : null}
              {vehicle.vehicleType ? (
                <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#5499BF] ring-1 ring-[#D3E9FC]">
                  {vehicle.vehicleType}
                </span>
              ) : null}
              <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#5499BF] ring-1 ring-[#D3E9FC]">
                {assignedWorkerLabel}
              </span>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={onEdit}
          className="h-10 shrink-0 rounded-[12px] bg-[#218EE7] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(33,142,231,0.22)] hover:bg-[#0B68BE]"
        >
          <Pencil className="size-4" />
          Edit Vehicle
        </Button>
      </div>
    </div>
  )
}
