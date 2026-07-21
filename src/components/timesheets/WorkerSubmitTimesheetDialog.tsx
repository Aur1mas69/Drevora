import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

type WorkerSubmitTimesheetDialogProps = {
  open: boolean
  weekNumber: number | string
  weekRangeLabel: string
  totalHoursLabel: string
  statusLabel: string
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Worker confirmation before week submission.
 * Opening / Cancel / Escape / outside click never submit — only Confirm does.
 */
export function WorkerSubmitTimesheetDialog({
  open,
  weekNumber,
  weekRangeLabel,
  totalHoursLabel,
  statusLabel,
  isSubmitting,
  onCancel,
  onConfirm,
}: WorkerSubmitTimesheetDialogProps) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        aria-label="Dismiss submit confirmation"
        disabled={isSubmitting}
        onClick={() => {
          if (!isSubmitting) onCancel()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-submit-timesheet-title"
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[#C5DFFB] bg-white shadow-[0_20px_48px_rgba(30,64,175,0.18)] dark:border-white/10 dark:bg-slate-900"
      >
        <div className="border-b border-[#D2E5F5] px-5 py-4 dark:border-white/10">
          <h2
            id="worker-submit-timesheet-title"
            className="text-lg font-semibold tracking-[-0.03em] text-[#163A63] dark:text-slate-100 sm:text-xl"
          >
            Submit Timesheet?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#5D7C9D] dark:text-slate-300">
            Please check all days before submitting this Timesheet.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <dl className="space-y-3 rounded-[14px] border border-[#D3E9FC] bg-[#F5FAFF] px-4 py-3 text-sm dark:border-white/10 dark:bg-slate-800/70">
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[#5D7C9D] dark:text-slate-400">
                Week
              </dt>
              <dd className="text-right font-semibold text-[#163A63] dark:text-slate-100">
                Week {weekNumber}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[#5D7C9D] dark:text-slate-400">
                Dates
              </dt>
              <dd className="text-right font-semibold text-[#163A63] dark:text-slate-100">
                {weekRangeLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[#5D7C9D] dark:text-slate-400">
                Total Hours
              </dt>
              <dd className="text-right font-semibold tabular-nums text-[#163A63] dark:text-slate-100">
                {totalHoursLabel}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="shrink-0 font-medium text-[#5D7C9D] dark:text-slate-400">
                Status
              </dt>
              <dd className="text-right font-semibold text-[#163A63] dark:text-slate-100">
                {statusLabel}
              </dd>
            </div>
          </dl>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Submitting sends this Timesheet to the office for review.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#D2E5F5] px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
            className="h-12 rounded-2xl border-[#D3E9FC] bg-white px-5 font-semibold text-[#0D477F] hover:bg-[#E8F3FE] dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={onConfirm}
            className="h-12 rounded-2xl bg-[#2F80ED] px-5 font-semibold text-white hover:bg-[#2569C7] disabled:opacity-70"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Timesheet'}
          </Button>
        </div>
      </section>
    </div>
  )
}
