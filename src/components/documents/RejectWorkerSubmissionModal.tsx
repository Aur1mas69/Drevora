import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Document } from '@/lib/documentTypes'
import { getDocumentPrimaryName } from '@/lib/documentUtils'
import { X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

type RejectWorkerSubmissionModalProps = {
  record: Document | null
  isOpen: boolean
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function RejectWorkerSubmissionModal({
  record,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: RejectWorkerSubmissionModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useBodyScrollLock(isOpen)

  if (!isOpen || !record || typeof window === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-[#D3E9FC] bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-[#113C69] dark:text-slate-100">
              Reject submission
            </h2>
            <p className="mt-1 text-sm text-[#5499BF]">{getDocumentPrimaryName(record)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5499BF] hover:bg-[#EEF6FF]"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[#113C69]">
            A rejection reason is required. The Worker will see this reason in their history.
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#5499BF]">Rejection reason</span>
            <textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setError(null)
              }}
              rows={4}
              className="w-full rounded-xl border border-[#C5DFFB] px-3 py-2 text-sm text-[#113C69]"
              placeholder="Explain why this submission was rejected"
              disabled={isSubmitting}
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-10 rounded-[12px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              const trimmed = reason.trim()
              if (!trimmed) {
                setError('Enter a rejection reason.')
                return
              }
              onConfirm(trimmed)
            }}
            className="h-10 rounded-[12px] bg-rose-600 text-white hover:bg-rose-700"
          >
            {isSubmitting ? 'Rejecting…' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
