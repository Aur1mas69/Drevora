import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimelineTab } from '@/components/vehicles/TimelineTab'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import { vehicleProfilePanelClass } from '@/components/vehicles/profile/vehicleProfileUi'
import type { Vehicle, VehicleAvailability } from '@/services/vehiclesService'

type VehicleProfileAvailabilityTabProps = {
  vehicle: Vehicle
  timelineVehicle: Vehicle | null
  isLoadingTimeline: boolean
  onAddAvailability: () => void
  onSelectRecord: (record: VehicleAvailability) => void
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function VehicleProfileAvailabilityTab({
  vehicle,
  timelineVehicle,
  isLoadingTimeline,
  onAddAvailability,
  onSelectRecord,
}: VehicleProfileAvailabilityTabProps) {
  const hasRecords = vehicle.availabilityRecords.length > 0

  return (
    <div className="space-y-4">
      <div className={`${vehicleProfilePanelClass} p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#113C69] dark:text-slate-100">Availability records</h3>
            <p className="mt-1 text-sm text-[#5499BF] dark:text-slate-400">
              Schedule date-based availability without changing the main vehicle record.
            </p>
          </div>
          <Button
            type="button"
            onClick={onAddAvailability}
            className="h-10 rounded-[12px] bg-[#218EE7] px-4 text-sm font-semibold text-white hover:bg-[#0B68BE]"
          >
            <Plus className="size-4" />
            Add availability
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          {!hasRecords ? (
            <div className="rounded-[14px] border border-dashed border-[#C5DFFB] bg-[#F8FBFF]/80 px-4 py-8 text-center dark:border-white/10 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
                No availability history recorded yet.
              </p>
              <p className="mt-1 text-xs text-[#5499BF] dark:text-slate-400">
                If no record exists, the vehicle uses its fallback status.
              </p>
            </div>
          ) : (
            vehicle.availabilityRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelectRecord(record)}
                className="flex w-full flex-col gap-3 rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:border-[#C5DFFB] hover:bg-[#F8FBFF] hover:shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-slate-600 dark:hover:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <VehicleStatusBadge status={record.status} />
                  <p className="mt-2 text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100">
                    {formatDate(record.startDate)} –{' '}
                    {record.endDate ? formatDate(record.endDate) : 'Ongoing'}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#5499BF] dark:text-slate-400">
                    Reason: {record.reason ?? 'Not set'}
                  </p>
                </div>
                <p className="max-w-md text-sm font-medium text-[#5499BF] dark:text-slate-400">
                  {record.notes ?? 'No notes'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {isLoadingTimeline ? (
        <div className={`${vehicleProfilePanelClass} space-y-3 p-5`}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-[#E8F3FE]/70" />
          ))}
        </div>
      ) : timelineVehicle ? (
        <TimelineTab vehicle={timelineVehicle} onSelectRecord={onSelectRecord} />
      ) : null}
    </div>
  )
}
