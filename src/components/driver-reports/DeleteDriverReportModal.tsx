import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { DriverReport } from '@/lib/driverReportTypes'
import { AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'

type DeleteDriverReportModalProps = {
  record: DriverReport
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteDriverReportModal({
  record,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteDriverReportModalProps) {
  useBodyScrollLock(true)

  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-[#D3E9FC] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#113C69] dark:text-slate-100">Delete report?</h2>
            <p className="mt-1 text-sm text-[#5499BF]">
              This will permanently remove <strong>{record.title}</strong> and any attachment.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
