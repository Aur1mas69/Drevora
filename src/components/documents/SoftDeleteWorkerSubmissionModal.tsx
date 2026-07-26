import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Document } from '@/lib/documentTypes'
import { getDocumentPrimaryName } from '@/lib/documentUtils'
import { documentTextareaClass } from './documentUiStyles'
import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

type SoftDeleteWorkerSubmissionModalProps = {
  record: Document | null
  isOpen: boolean
  isDeleting: boolean
  errorMessage: string | null
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export function SoftDeleteWorkerSubmissionModal({
  record,
  isOpen,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: SoftDeleteWorkerSubmissionModalProps) {
  useBodyScrollLock(isOpen)
  const [reason, setReason] = useState('')

  if (!isOpen || !record || typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-[#D3E9FC] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900/95">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#113C69]">Delete Worker upload?</h2>
            <p className="mt-1 text-sm text-[#5499BF]">
              <strong>{getDocumentPrimaryName(record)}</strong>
              {record.workerName ? <> (Worker: {record.workerName})</> : null} will be removed
              from the active Worker Uploads list and can be restored from Archived. Uploaded
              files are retained.
            </p>
          </div>
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-xs font-semibold text-[#5499BF]">
            Delete reason <span className="font-normal">(optional)</span>
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={documentTextareaClass}
            rows={3}
            disabled={isDeleting}
            placeholder="Why is this upload being archived?"
          />
        </label>

        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={isDeleting}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {isDeleting ? 'Deleting…' : 'Delete upload'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
