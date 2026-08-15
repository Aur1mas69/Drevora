import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import {
  documentReviewI18nKey,
  documentTypeI18nKey,
  translateWorkerSubmissionFileError,
} from '@/i18n/workerPhase3bDisplay'
import { cn } from '@/lib/utils'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import {
  formatFileSizeBytes,
  isWorkerSubmissionPdfMime,
  mergeWorkerSubmissionFiles,
  resolveWorkerSubmissionMimeType,
  validateWorkerSubmissionFiles,
} from '@/lib/workerDocumentSubmissionStorage'
import {
  WORKER_SUBMISSION_DOCUMENT_TYPES,
  WORKER_SUBMISSION_MAX_FILES,
  type WorkerDocumentSubmission,
  type WorkerSubmissionDocumentType,
} from '@/lib/workerDocumentSubmissionTypes'
import {
  downloadWorkerSubmissionFile,
  getWorkerSubmissionFileSignedUrl,
  WorkerDocumentSubmissionStorageError,
} from '@/services/workerDocumentSubmissionStorageService'
import {
  createWorkerDocumentSubmission,
  fetchMyWorkerDocumentSubmissions,
  WorkerDocumentSubmissionsServiceError,
} from '@/services/workerDocumentSubmissionsService'
import { FileText, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

function reviewBadgeClass(status: WorkerDocumentSubmission['reviewStatus']): string {
  switch (status) {
    case 'pending_review':
      return 'bg-amber-50 text-amber-800 ring-amber-200'
    case 'reviewed':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    case 'rejected':
      return 'bg-rose-50 text-rose-800 ring-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

export default function WorkerDocumentsPage() {
  const { t } = useTranslation('worker')
  const { formatDateTime } = useCompanySettings()
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const isDark = useIsWorkerDarkMode()

  const [history, setHistory] = useState<WorkerDocumentSubmission[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [documentType, setDocumentType] =
    useState<WorkerSubmissionDocumentType>('CMR')
  const [customDocumentName, setCustomDocumentName] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openingFileId, setOpeningFileId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const rows = await fetchMyWorkerDocumentSubmissions()
      setHistory(rows)
    } catch (error) {
      setHistory([])
      setHistoryError(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : t('documents.loadFailed'),
      )
    } finally {
      setHistoryLoading(false)
    }
  }, [t])

  useEffect(() => {
    let cancelled = false

    void Promise.resolve().then(async () => {
      if (cancelled) return
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const rows = await fetchMyWorkerDocumentSubmissions()
        if (cancelled) return
        setHistory(rows)
      } catch (error) {
        if (cancelled) return
        setHistory([])
        setHistoryError(
          error instanceof WorkerDocumentSubmissionsServiceError
            ? error.message
            : t('documents.loadFailed'),
        )
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  function clearForm() {
    setDocumentType('CMR')
    setCustomDocumentName('')
    setReferenceNumber('')
    setNotes('')
    setFiles([])
    setFormError(null)
  }

  function onFilesSelected(fileList: FileList | null) {
    setSuccessMessage(null)
    setFormError(null)
    if (!fileList || fileList.length === 0) return

    const { files: next, error } = mergeWorkerSubmissionFiles(
      files,
      Array.from(fileList),
    )
    setFiles(next)
    if (error) setFormError(translateWorkerSubmissionFileError(error, t))
  }

  function removeFile(index: number) {
    setFormError(null)
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSuccessMessage(null)
    setFormError(null)

    if (!worker?.id) {
      setFormError(t('documents.workerRequired'))
      return
    }

    if (documentType === 'Other' && !customDocumentName.trim()) {
      setFormError(t('documents.otherNameRequired'))
      return
    }

    const validationError = translateWorkerSubmissionFileError(
      validateWorkerSubmissionFiles(files),
      t,
    )
    if (validationError) {
      setFormError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      await createWorkerDocumentSubmission(worker.id, {
        documentType,
        customDocumentName,
        referenceNumber,
        notes,
        files,
      })
      clearForm()
      setSuccessMessage(t('documents.sentSuccess'))
      await loadHistory()
    } catch (error) {
      setFormError(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : t('documents.sendFailed'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function openAttachment(filePath: string, attachmentId: string) {
    setOpeningFileId(attachmentId)
    try {
      const url = await getWorkerSubmissionFileSignedUrl(filePath)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setHistoryError(t('documents.openFailed'))
    } finally {
      setOpeningFileId(null)
    }
  }

  async function downloadAttachment(
    filePath: string,
    originalFileName: string,
    attachmentId: string,
    mimeType?: string | null,
  ) {
    setOpeningFileId(attachmentId)
    try {
      await downloadWorkerSubmissionFile(filePath, originalFileName, mimeType)
    } catch (error) {
      setHistoryError(
        error instanceof WorkerDocumentSubmissionStorageError
          ? error.message
          : t('documents.downloadFailed'),
      )
    } finally {
      setOpeningFileId(null)
    }
  }

  if (workerLoading) {
    return (
      <div className="mx-auto flex max-w-md items-center gap-2 py-16 text-sm text-slate-500 lg:max-w-2xl">
        <Loader2 className="size-4 animate-spin" />
        {t('documents.loading')}
      </div>
    )
  }

  if (workerError || !worker) {
    return (
      <div className="mx-auto max-w-md space-y-2 lg:max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t('documents.title')}</h1>
        <p className="text-sm text-rose-600">{workerError ?? t('documents.profileUnavailable')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-5 overflow-x-hidden lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t('documents.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('documents.subtitle')}
        </p>
      </header>

      <Card className="gap-0 overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white py-0 shadow-lg shadow-slate-200/60">
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-lg font-semibold text-slate-950">{t('documents.sendTitle')}</CardTitle>
          <CardDescription className="text-slate-500">
            {t('documents.sendHint')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">{t('documents.documentType')}</span>
              <select
                value={documentType}
                onChange={(event) => {
                  setDocumentType(event.target.value as WorkerSubmissionDocumentType)
                  setSuccessMessage(null)
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                required
              >
                {WORKER_SUBMISSION_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(documentTypeI18nKey(type))}
                  </option>
                ))}
              </select>
            </label>

            {documentType === 'Other' ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-600">{t('documents.documentName')}</span>
                <input
                  type="text"
                  value={customDocumentName}
                  onChange={(event) => setCustomDocumentName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder={t('documents.documentNamePlaceholder')}
                  required
                />
              </label>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">
                {t('documents.referenceOptional')}
              </span>
              <input
                type="text"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">
                {t('documents.notesOptional')}
              </span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-600">{t('documents.attachments')}</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label
                  className={`inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 ${
                    files.length >= WORKER_SUBMISSION_MAX_FILES
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer'
                  }`}
                >
                  {t('documents.chooseFiles')}
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    disabled={files.length >= WORKER_SUBMISSION_MAX_FILES}
                    className="sr-only"
                    onChange={(event) => {
                      onFilesSelected(event.target.files)
                      event.target.value = ''
                    }}
                  />
                </label>
                <label
                  className={`inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 ${
                    files.length >= WORKER_SUBMISSION_MAX_FILES
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer'
                  }`}
                >
                  {t('documents.takePhoto')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={files.length >= WORKER_SUBMISSION_MAX_FILES}
                    className="sr-only"
                    onChange={(event) => {
                      onFilesSelected(event.target.files)
                      event.target.value = ''
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">
                {t('documents.attachHint', { max: WORKER_SUBMISSION_MAX_FILES })}
              </p>

              {files.length > 0 ? (
                <ul className="space-y-2">
                  {files.map((file, index) => {
                    const mimeType = resolveWorkerSubmissionMimeType(file)
                    const kindLabel = mimeType
                      ? isWorkerSubmissionPdfMime(mimeType)
                        ? t('documents.kindPdf')
                        : t('documents.kindImage')
                      : t('documents.kindFile')
                    return (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {kindLabel} · {formatFileSizeBytes(file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                          aria-label={t('documents.removeFileAria', { name: file.name })}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>

            {formError ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
            ) : null}
            {successMessage ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl bg-[#0B68BE] text-white hover:bg-[#095aa5]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('documents.sending')}
                </>
              ) : (
                <>
                  <FileText className="mr-2 size-4" />
                  {t('documents.sendDocument')}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t('documents.historyTitle')}</h2>
          <p className="text-sm text-slate-500">{t('documents.historyHint')}</p>
        </div>

        {historyLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            {t('documents.loadingHistory')}
          </div>
        ) : null}

        {historyError ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{historyError}</p>
        ) : null}

        {!historyLoading && !historyError && history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {t('documents.empty')}
          </div>
        ) : null}

        <ul className="worker-list-stack">
          {history.map((submission, index) => (
            <li
              key={submission.id}
              className={workerListCardClass(index, isDark)}
            >
              <div className="worker-list-card__meta">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'worker-accent-title truncate text-sm font-semibold',
                      !isDark && 'text-slate-950',
                    )}
                  >
                    {submission.documentType === 'Other'
                      ? submission.customDocumentName?.trim() || t('documents.typeOther')
                      : t(documentTypeI18nKey(submission.documentType))}
                  </p>
                  {submission.documentType === 'Other' ? null : (
                    <p
                      className={cn(
                        'worker-accent-muted text-[11px]',
                        !isDark && 'text-slate-500',
                      )}
                    >
                      {t(documentTypeI18nKey(submission.documentType))}
                    </p>
                  )}
                  <p
                    className={cn(
                      'worker-accent-muted text-[11px]',
                      !isDark && 'text-slate-500',
                    )}
                  >
                    {formatDateTime(submission.submittedAt)}
                    {' · '}
                    {submission.attachments.length === 1
                      ? t('documents.fileOne', { count: submission.attachments.length })
                      : t('documents.fileOther', { count: submission.attachments.length })}
                  </p>
                </div>
                <span
                  className={cn(
                    'worker-accent-badge inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                    reviewBadgeClass(submission.reviewStatus),
                  )}
                >
                  {t(documentReviewI18nKey(submission.reviewStatus))}
                </span>
              </div>

              <ul className="mt-1.5 space-y-0.5">
                {submission.attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex min-h-11 items-center justify-between gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        'worker-accent-secondary min-w-0 truncate text-xs',
                        !isDark && 'text-slate-700',
                      )}
                    >
                      {attachment.originalFileName}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={openingFileId === attachment.id}
                        onClick={() =>
                          void openAttachment(attachment.filePath, attachment.id)
                        }
                        className="min-h-11 px-1 text-xs font-semibold text-[#0B68BE] hover:underline disabled:opacity-60"
                      >
                        {t('documents.view')}
                      </button>
                      <button
                        type="button"
                        disabled={openingFileId === attachment.id}
                        onClick={() =>
                          void downloadAttachment(
                            attachment.filePath,
                            attachment.originalFileName,
                            attachment.id,
                            attachment.mimeType,
                          )
                        }
                        className="min-h-11 px-1 text-xs font-semibold text-[#0B68BE] hover:underline disabled:opacity-60"
                      >
                        {t('documents.download')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {submission.reviewStatus === 'rejected' && submission.rejectionReason ? (
                <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                  {t('documents.rejectionReason', { reason: submission.rejectionReason })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
