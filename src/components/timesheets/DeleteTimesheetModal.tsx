import { Button } from '@/components/ui/button'
import type { TimesheetListItem } from '@/lib/timesheetTypes'
import { getStatusLabel } from '@/lib/timesheetUtils'
import { useEffect } from 'react'

type DeleteTimesheetModalProps = {
  timesheet: TimesheetListItem
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteTimesheetModal({
  timesheet,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteTimesheetModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[20px] border border-[#D3E9FC] bg-white p-5 shadow-[0_30px_80px_rgba(11,38,70,0.18)] dark:border-white/10 dark:bg-slate-900 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-timesheet-title"
      >
        <h2
          id="delete-timesheet-title"
          className="text-xl font-semibold leading-snug tracking-[-0.03em] text-[#113C69] dark:text-slate-50"
        >
          Delete timesheet?
        </h2>
        <p className="mt-2 text-sm font-medium leading-6 text-[#3D7A9C] dark:text-slate-300">
          Are you sure you want to delete this timesheet?
        </p>

        <dl className="mt-4 space-y-2 rounded-[14px] border border-[#D3E9FC] bg-[#F5FAFF] px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-800/70">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="font-semibold text-[#3D7A9C] dark:text-slate-400">Worker</dt>
            <dd className="font-medium text-[#113C69] dark:text-slate-100">{timesheet.driverName}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="font-semibold text-[#3D7A9C] dark:text-slate-400">Week</dt>
            <dd className="font-medium text-[#113C69] dark:text-slate-100">
              {timesheet.weekRangeLabel}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="font-semibold text-[#3D7A9C] dark:text-slate-400">Status</dt>
            <dd className="font-medium text-[#113C69] dark:text-slate-100">
              {getStatusLabel(timesheet.status)}
            </dd>
          </div>
        </dl>

        {errorMessage ? (
          <div className="mt-4 rounded-[12px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-11 rounded-[14px] border-[#D3E9FC] bg-white px-5 font-semibold text-[#0D477F] hover:bg-[#E8F3FE] dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-11 rounded-[14px] bg-rose-600 px-5 font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] hover:bg-rose-700 disabled:opacity-70 dark:bg-rose-700 dark:hover:bg-rose-600"
          >
            {isDeleting ? 'Deleting…' : 'Delete timesheet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
