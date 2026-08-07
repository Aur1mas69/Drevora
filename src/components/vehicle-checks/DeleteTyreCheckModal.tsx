import { Button } from '@/components/ui/button'
import type { TyreCheckListItem } from '@/lib/tyreCheckTypes'
import { useEffect, useState } from 'react'

type DeleteTyreCheckModalProps = {
  check: TyreCheckListItem | null
  isOpen: boolean
  isSaving: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirm: (reason: string) => void
}

/** Office-only soft-delete confirmation for a completed Tyre Check. */
export function DeleteTyreCheckModal({
  check,
  isOpen,
  isSaving,
  errorMessage,
  onClose,
  onConfirm,
}: DeleteTyreCheckModalProps) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setReason('')
    setLocalError(null)
  }, [isOpen, check?.id])

  if (!isOpen || !check) return null

  function handleSubmit() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setLocalError('Enter a deletion reason.')
      return
    }
    setLocalError(null)
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-tyre-check-title"
        className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-rose-100 dark:bg-slate-900/95 dark:ring-white/10 dark:shadow-black/50 sm:p-6"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-600">
          Delete Tyre Check
        </p>
        <h2
          id="delete-tyre-check-title"
          className="mt-2 text-xl font-semibold leading-snug tracking-[-0.03em] text-slate-950 dark:text-slate-100"
        >
          Soft-delete this completed Tyre Check?
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          The check is removed from the normal Admin list only. Measurements,
          corrections and audit history stay stored. This is not a hard delete.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {check.vehicleRegistration}
          {check.trailerRegistration || check.trailerNumber
            ? ` + ${check.trailerRegistration || check.trailerNumber}`
            : ''}{' '}
          · {check.workerName}
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
            Deletion reason (required)
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isSaving}
            rows={3}
            className="mt-2 w-full resize-y rounded-[12px] border border-rose-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100"
            placeholder="Describe why this Tyre Check should be removed from the active list…"
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
            className="h-11 rounded-[16px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-11 rounded-[16px] bg-rose-600 font-semibold text-white hover:bg-rose-700 disabled:opacity-70"
          >
            {isSaving ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
