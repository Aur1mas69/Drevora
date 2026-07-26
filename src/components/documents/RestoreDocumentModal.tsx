import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Document } from '@/lib/documentTypes'
import { RotateCcw } from 'lucide-react'
import { createPortal } from 'react-dom'

type RestoreDocumentModalProps = {
  record: Document
  errorMessage: string | null
  isRestoring: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function RestoreDocumentModal({
  record,
  errorMessage,
  isRestoring,
  onCancel,
  onConfirm,
}: RestoreDocumentModalProps) {
  useBodyScrollLock(true)

  if (typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-[#D3E9FC] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-[#0B68BE]">
            <RotateCcw className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#113C69]">Restore document?</h2>
            <p className="mt-1 text-sm text-[#5499BF]">
              This will return <strong>{record.documentName}</strong>
              {record.workerName ? (
                <>
                  {' '}
                  (Worker: {record.workerName})
                </>
              ) : record.vehicleLabel ? (
                <>
                  {' '}
                  (Vehicle: {record.vehicleLabel})
                </>
              ) : null}{' '}
              to the active Documents list. The same record ID, metadata, and attachment are
              preserved.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isRestoring}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isRestoring}
            className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
          >
            {isRestoring ? 'Restoring…' : 'Restore Document'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
