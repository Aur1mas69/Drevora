import { Button } from '@/components/ui/button'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'

type DeleteVehicleCheckModalProps = {
  check: VehicleCheckListItem
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteVehicleCheckModal({
  check,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteVehicleCheckModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-500">
          Delete Vehicle Check
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-snug tracking-[-0.03em] text-slate-950">
          Are you sure you want to delete this vehicle check? This action cannot be undone.
        </h2>
        <p className="mt-3 text-sm font-medium text-slate-500">
          {check.vehicleRegistration}
          {check.fleetNumber ? ` · Fleet ${check.fleetNumber}` : ''} · {check.workerName} ·{' '}
          {check.inspectionDate}
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-11 rounded-[16px] bg-rose-600 px-5 font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-rose-700 disabled:translate-y-0 disabled:opacity-70"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
