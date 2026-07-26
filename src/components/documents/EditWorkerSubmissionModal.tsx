import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Document } from '@/lib/documentTypes'
import {
  getDocumentFileCountLabel,
  getDocumentPrimaryName,
  getWorkerSubmissionReviewLabel,
} from '@/lib/documentUtils'
import {
  WORKER_SUBMISSION_DOCUMENT_TYPES,
  type WorkerSubmissionDocumentType,
} from '@/lib/workerDocumentSubmissionTypes'
import { documentFieldClass, documentSelectClass, documentTextareaClass } from './documentUiStyles'
import { useState } from 'react'
import { createPortal } from 'react-dom'

export type EditWorkerSubmissionValues = {
  documentType: WorkerSubmissionDocumentType
  customDocumentName: string
  referenceNumber: string
  notes: string
}

type EditWorkerSubmissionModalProps = {
  record: Document | null
  isOpen: boolean
  isSaving: boolean
  errorMessage: string | null
  formatDateTime: (value: string) => string
  onClose: () => void
  onSubmit: (values: EditWorkerSubmissionValues) => void
}

function resolveInitialType(record: Document): WorkerSubmissionDocumentType {
  return (WORKER_SUBMISSION_DOCUMENT_TYPES as readonly string[]).includes(record.documentType)
    ? (record.documentType as WorkerSubmissionDocumentType)
    : 'Other'
}

export function EditWorkerSubmissionModal({
  record,
  isOpen,
  isSaving,
  errorMessage,
  formatDateTime,
  onClose,
  onSubmit,
}: EditWorkerSubmissionModalProps) {
  useBodyScrollLock(isOpen)
  const initialType = record ? resolveInitialType(record) : 'CMR'
  const [documentType, setDocumentType] =
    useState<WorkerSubmissionDocumentType>(initialType)
  const [customDocumentName, setCustomDocumentName] = useState(
    record && initialType === 'Other' ? record.documentName?.trim() || '' : '',
  )
  const [referenceNumber, setReferenceNumber] = useState(
    record?.referenceNumber?.trim() || '',
  )
  const [notes, setNotes] = useState(record?.notes?.trim() || '')
  const [localError, setLocalError] = useState<string | null>(null)

  if (!isOpen || !record || typeof window === 'undefined') return null

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (documentType === 'Other' && !customDocumentName.trim()) {
      setLocalError('Enter a document name when type is Other.')
      return
    }
    setLocalError(null)
    onSubmit({
      documentType,
      customDocumentName,
      referenceNumber,
      notes,
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-[18px] border border-[#D3E9FC] bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900/95"
      >
        <h2 className="text-lg font-semibold text-[#113C69]">Edit Worker upload</h2>
        <p className="mt-1 text-sm text-[#5499BF]">
          Update document metadata only. Worker, sent date, review status and files stay
          unchanged.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-[#5499BF]">Worker</span>
            <input
              value={record.workerName?.trim() || '—'}
              readOnly
              className={`${documentFieldClass} bg-[#F1F6FB] text-[#5499BF]`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#5499BF]">Sent</span>
            <input
              value={record.submittedAt ? formatDateTime(record.submittedAt) : '—'}
              readOnly
              className={`${documentFieldClass} bg-[#F1F6FB] text-[#5499BF]`}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#5499BF]">Status</span>
            <input
              value={getWorkerSubmissionReviewLabel(record.reviewStatus)}
              readOnly
              className={`${documentFieldClass} bg-[#F1F6FB] text-[#5499BF]`}
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-[#5499BF]">Document type</span>
            <select
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value as WorkerSubmissionDocumentType)
              }
              className={`${documentSelectClass} w-full`}
              disabled={isSaving}
            >
              {WORKER_SUBMISSION_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {documentType === 'Other' ? (
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-semibold text-[#5499BF]">Custom name</span>
              <input
                value={customDocumentName}
                onChange={(event) => setCustomDocumentName(event.target.value)}
                className={documentFieldClass}
                disabled={isSaving}
                required
              />
            </label>
          ) : null}
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-[#5499BF]">Reference</span>
            <input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              className={documentFieldClass}
              disabled={isSaving}
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-[#5499BF]">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={documentTextareaClass}
              disabled={isSaving}
              rows={3}
            />
          </label>
          <div className="sm:col-span-2 rounded-xl border border-[#D3E9FC] bg-[#F8FBFF] px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
              Attachments
            </p>
            <p className="mt-1 text-sm font-medium text-[#113C69]">
              {getDocumentPrimaryName(record)} · {getDocumentFileCountLabel(record)} (read-only)
            </p>
          </div>
        </div>

        {localError || errorMessage ? (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {localError || errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-[#218EE7] text-white hover:bg-[#0B68BE]"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
