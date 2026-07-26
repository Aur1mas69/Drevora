import { Button } from '@/components/ui/button'
import type { Vehicle } from '@/services/vehiclesService'

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

type RestoreVehicleModalProps = {
  vehicle: Vehicle
  errorMessage: string | null
  isRestoring: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function RestoreVehicleModal({
  vehicle,
  errorMessage,
  isRestoring,
  onCancel,
  onConfirm,
}: RestoreVehicleModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-950 dark:ring-white/10 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#218EE7]">
          Restore Vehicle
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-100">
          Restore this vehicle?
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
          {vehicle.registration || getVehicleName(vehicle)} will return to the Active
          list and occupy one plan seat again.
        </p>
        {vehicle.archiveReason ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Archived reason: <span className="font-semibold">{vehicle.archiveReason}</span>
          </p>
        ) : null}
        {vehicle.retentionExpiresAt ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Retained until:{' '}
            <span className="font-semibold">
              {vehicle.retentionExpiresAt.slice(0, 10)}
            </span>
          </p>
        ) : null}

        {errorMessage ? (
          <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isRestoring}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-white/10"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isRestoring}
            className="h-11 rounded-[16px] bg-[#218EE7] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(33,142,231,0.22)] hover:bg-[#0B68BE] disabled:opacity-70"
          >
            {isRestoring ? 'Restoring...' : 'Restore Vehicle'}
          </Button>
        </div>
      </div>
    </div>
  )
}
