import { Button } from '@/components/ui/button'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'
import { formatVehicleCheckReference } from '@/lib/vehicleCheckUtils'
import { useEffect, useState } from 'react'

type CreateVehicleCheckCorrectionModalProps = {
  check: VehicleCheckListItem | null
  isOpen: boolean
  isSaving: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function CreateVehicleCheckCorrectionModal({
  check,
  isOpen,
  isSaving,
  errorMessage,
  onClose,
  onConfirm,
}: CreateVehicleCheckCorrectionModalProps) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setReason('')
    setLocalError(null)
  }, [isOpen, check?.id])

  if (!isOpen || !check) return null

  const reference = formatVehicleCheckReference(check.id)

  function handleSubmit() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setLocalError('Enter a correction reason.')
      return
    }
    setLocalError(null)
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-correction-title"
        className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 dark:shadow-black/50 sm:p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563EB]">
          Create Correction
        </p>
        <h2
          id="create-correction-title"
          className="mt-2 text-xl font-semibold leading-snug tracking-[-0.03em] text-slate-950 dark:text-slate-100"
        >
          Create a correction for Vehicle Check {reference}?
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          The original completed inspection will remain unchanged. A new linked
          correction record will be created for you to edit and complete.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {check.vehicleRegistration}
          {check.fleetNumber ? ` · Fleet ${check.fleetNumber}` : ''} ·{' '}
          {check.workerName}
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            Correction reason
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isSaving}
            rows={3}
            className="mt-2 w-full resize-y rounded-[12px] border border-[rgba(75,120,220,0.18)] bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[#2563EB] dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
            placeholder="Describe why this inspection needs a correction…"
          />
        </label>

        {localError || errorMessage ? (
          <div className="mt-4 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
            {localError || errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB] dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-800/50 dark:hover:text-blue-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-11 rounded-[16px] bg-[#2563EB] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#1d4ed8] disabled:translate-y-0 disabled:opacity-70"
          >
            {isSaving ? 'Creating…' : 'Create Correction'}
          </Button>
        </div>
      </div>
    </div>
  )
}
