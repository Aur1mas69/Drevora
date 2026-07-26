import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import {
  getDocumentArchiveReason,
  getDocumentArchiveReasonLabel,
  type Document,
} from '@/lib/documentTypes'
import {
  canEditDocumentRecord,
  canReviewWorkerSubmission,
  documentStatusClassMap,
  formatRetentionUntilDate,
  getDocumentDisplayStatus,
  getDocumentPrimaryName,
  getDocumentSecondaryType,
  getDocumentStatusLabel,
  getWorkerSubmissionReviewLabel,
  hasDocumentFile,
  isWorkerSubmissionDocument,
  workerSubmissionReviewClassMap,
} from '@/lib/documentUtils'
import { getWorkerSubmissionFileSignedUrl } from '@/services/workerDocumentSubmissionStorageService'
import { Check, ExternalLink, Pencil, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type DocumentDrawerProps = {
  record: Document | null
  isOpen: boolean
  formatDate: (value: string) => string
  formatDateTime: (value: string) => string
  onClose: () => void
  onEdit: (document: Document) => void
  onOpenFile: (document: Document) => void
  onMarkReviewed?: (document: Document) => void
  onReject?: (document: Document) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#113C69] dark:text-slate-100">{value}</dd>
    </div>
  )
}

export function DocumentDrawer({
  record,
  isOpen,
  formatDate,
  formatDateTime,
  onClose,
  onEdit,
  onOpenFile,
  onMarkReviewed,
  onReject,
}: DocumentDrawerProps) {
  useBodyScrollLock(isOpen)
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  if (!isOpen || !record || typeof window === 'undefined') return null

  const archiveReason = getDocumentArchiveReason(record)
  const displayStatus = getDocumentDisplayStatus(record)
  const retentionUntil =
    archiveReason === 'archived_worker' || record.workerArchivedAt
      ? formatRetentionUntilDate(record.workerArchivedAt, formatDate)
      : null
  const canEdit = canEditDocumentRecord(record)
  const isSubmission = isWorkerSubmissionDocument(record)
  const canReview = canReviewWorkerSubmission(record)
  const secondaryType = getDocumentSecondaryType(record)
  const attachments = [...(record.attachments ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )

  async function openAttachment(filePath: string, attachmentId: string) {
    setAttachmentError(null)
    setOpeningAttachmentId(attachmentId)
    try {
      const url = await getWorkerSubmissionFileSignedUrl(filePath)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setAttachmentError('Unable to open that file.')
    } finally {
      setOpeningAttachmentId(null)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="flex-1" aria-label="Close drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[#D3E9FC] bg-gradient-to-b from-white to-[#F5FAFF] shadow-[-12px_0_40px_rgba(33,142,231,0.12)] dark:border-white/10 dark:from-slate-900/95 dark:to-slate-900/90 dark:shadow-black/40">
        <div className="flex items-start justify-between border-b border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#218EE7]">
              {isSubmission ? 'Worker upload' : record.appliesTo}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#113C69] dark:text-slate-100">
              {getDocumentPrimaryName(record)}
            </h2>
            {secondaryType ? (
              <p className="mt-0.5 text-sm text-[#5499BF]">{secondaryType}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5499BF] hover:bg-[#EEF6FF] dark:hover:bg-slate-800/50"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {isSubmission && record.reviewStatus ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${workerSubmissionReviewClassMap[record.reviewStatus]}`}
              >
                {getWorkerSubmissionReviewLabel(record.reviewStatus)}
              </span>
            ) : (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap[displayStatus]}`}
              >
                {archiveReason
                  ? getDocumentArchiveReasonLabel(archiveReason)
                  : getDocumentStatusLabel(displayStatus)}
              </span>
            )}
            {record.workerArchivedAt ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                Worker archived
              </span>
            ) : null}
          </div>

          <dl className="mt-5 grid gap-4">
            {record.workerName ? (
              <DetailRow label="Worker" value={record.workerName} />
            ) : null}
            {!isSubmission && record.vehicleLabel ? (
              <DetailRow label="Vehicle" value={record.vehicleLabel} />
            ) : null}
            <DetailRow label="Reference" value={record.referenceNumber?.trim() || '—'} />
            {isSubmission ? (
              <DetailRow
                label="Submitted"
                value={
                  record.submittedAt ? formatDateTime(record.submittedAt) : '—'
                }
              />
            ) : (
              <>
                <DetailRow
                  label="Issue date"
                  value={record.issueDate ? formatDate(record.issueDate) : '—'}
                />
                <DetailRow
                  label="Expiry date"
                  value={record.expiryDate ? formatDate(record.expiryDate) : '—'}
                />
              </>
            )}
            {retentionUntil ? (
              <DetailRow label="Retention until" value={retentionUntil} />
            ) : null}
            {record.deletedAt ? (
              <DetailRow label="Deleted" value={formatDate(record.deletedAt.slice(0, 10))} />
            ) : null}
            <DetailRow label="Notes" value={record.notes?.trim() || '—'} />
            {isSubmission && record.reviewStatus === 'rejected' ? (
              <DetailRow
                label="Rejection reason"
                value={record.rejectionReason?.trim() || '—'}
              />
            ) : null}
            {!isSubmission && record.createdAt ? (
              <DetailRow label="Created" value={formatDate(record.createdAt.slice(0, 10))} />
            ) : null}
          </dl>

          {isSubmission ? (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                Attachments
              </p>
              {attachments.length === 0 ? (
                <p className="text-sm text-[#5499BF]">No files</p>
              ) : (
                <ul className="space-y-3">
                  {attachments.map((attachment) => {
                    const isImage = attachment.mimeType.startsWith('image/')
                    return (
                      <li
                        key={attachment.id}
                        className="rounded-xl border border-[#D3E9FC] bg-white p-3"
                      >
                        <p className="truncate text-sm font-medium text-[#113C69]">
                          {attachment.originalFileName}
                        </p>
                        <p className="mt-0.5 text-xs text-[#5499BF]">{attachment.mimeType}</p>
                        {isImage ? (
                          <AttachmentImagePreview filePath={attachment.filePath} />
                        ) : null}
                        <div className="mt-2 flex gap-3">
                          <button
                            type="button"
                            disabled={openingAttachmentId === attachment.id}
                            onClick={() =>
                              void openAttachment(attachment.filePath, attachment.id)
                            }
                            className="text-xs font-semibold text-[#0B68BE] hover:underline disabled:opacity-60"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            disabled={openingAttachmentId === attachment.id}
                            onClick={() =>
                              void openAttachment(attachment.filePath, attachment.id)
                            }
                            className="text-xs font-semibold text-[#0B68BE] hover:underline disabled:opacity-60"
                          >
                            Download
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {attachmentError ? (
                <p className="text-sm text-rose-600">{attachmentError}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#D3E9FC] px-5 py-4 dark:border-white/10">
          {!isSubmission && hasDocumentFile(record) ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenFile(record)}
              className="h-10 rounded-[12px] border-[#C5DFFB] text-[#0B68BE]"
            >
              <ExternalLink className="mr-1.5 size-4" />
              Open attachment
            </Button>
          ) : null}
          {canReview && onMarkReviewed ? (
            <Button
              type="button"
              onClick={() => onMarkReviewed(record)}
              className="h-10 rounded-[12px] bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="mr-1.5 size-4" />
              Mark as Reviewed
            </Button>
          ) : null}
          {canReview && onReject ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onReject(record)}
              className="h-10 rounded-[12px] border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <XCircle className="mr-1.5 size-4" />
              Reject
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              onClick={() => onEdit(record)}
              className="h-10 rounded-[12px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white"
            >
              <Pencil className="mr-1.5 size-4" />
              Edit document
            </Button>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  )
}

function AttachmentImagePreview({ filePath }: { filePath: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void getWorkerSubmissionFileSignedUrl(filePath)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  if (!url) {
    return <p className="mt-2 text-xs text-[#5499BF]">Preview unavailable</p>
  }

  return (
    <img
      src={url}
      alt=""
      className="mt-2 max-h-48 w-full rounded-lg object-contain bg-slate-50"
    />
  )
}
