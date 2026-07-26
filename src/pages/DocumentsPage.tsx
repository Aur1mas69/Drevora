import { DeleteDocumentModal } from '@/components/documents/DeleteDocumentModal'
import { DocumentDrawer } from '@/components/documents/DocumentDrawer'
import {
  DocumentFormModal,
  documentFormValuesToInput,
} from '@/components/documents/DocumentFormModal'
import { getDocumentStoragePath } from '@/components/documents/DocumentFileField'
import { DocumentsDataTable } from '@/components/documents/DocumentsDataTable'
import { DocumentsEmptyState } from '@/components/documents/DocumentsEmptyState'
import { DocumentsPagination } from '@/components/documents/DocumentsPagination'
import {
  DocumentsSummaryCards,
  WorkerUploadSummaryCards,
} from '@/components/documents/DocumentsSummaryCards'
import { DocumentsToolbar } from '@/components/documents/DocumentsToolbar'
import { EditWorkerSubmissionModal } from '@/components/documents/EditWorkerSubmissionModal'
import { RejectWorkerSubmissionModal } from '@/components/documents/RejectWorkerSubmissionModal'
import { RestoreDocumentModal } from '@/components/documents/RestoreDocumentModal'
import { RestoreWorkerSubmissionModal } from '@/components/documents/RestoreWorkerSubmissionModal'
import { SoftDeleteWorkerSubmissionModal } from '@/components/documents/SoftDeleteWorkerSubmissionModal'
import { documentPageCardClass } from '@/components/documents/documentUiStyles'
import { ExportMenu } from '@/components/export/ExportMenu'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import {
  DEFAULT_EXPORT_DATE_RANGE,
  resolveExportDateRange,
  rowMatchesExportDateRange,
  type ExportDateRangeSelection,
} from '@/lib/export/exportDateRange'
import { toExportUserMessage } from '@/lib/export/exportErrors'
import {
  countDownloadableDocumentFiles,
  downloadFilteredDocumentsZip,
  downloadManagedDocumentOriginalFile,
  downloadWorkerSubmissionOriginalFile,
  downloadWorkerSubmissionZip,
  exportManagedDocumentsCsv,
  exportWorkerUploadsCsv,
} from '@/lib/export/modules/documentsExport'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  Document,
  DocumentAppliesTo,
  DocumentAppliesToFilter,
  DocumentFormSubmitPayload,
  DocumentLifecycleFilter,
  DocumentsCentreTab,
  DocumentsPageMode,
  DocumentStatusFilter,
  DocumentTypeFilter,
  DocumentWorkerUploadStatusFilter,
} from '@/lib/documentTypes'
import type { WorkerSubmissionDocumentType } from '@/lib/workerDocumentSubmissionTypes'
import { DEFAULT_DOCUMENT_PAGE_SIZE } from '@/lib/documentTypes'
import { isMedicalDocumentType } from '@/lib/documentTypes'
import {
  canEditDocumentRecord,
  canEditWorkerSubmission,
  canRestoreDocumentRecord,
  canRestoreWorkerSubmission,
  canSoftDeleteWorkerSubmission,
  computeDocumentSummaryStats,
  computeWorkerUploadSummaryStats,
  countPendingWorkerUploads,
  filterDocumentsByQuery,
  isWorkerSubmissionDocument,
} from '@/lib/documentUtils'
import { adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import {
  applyDocumentFileChanges,
  DocumentFileStorageError,
  getDocumentFileSignedUrl,
  uploadDocumentFile,
} from '@/services/documentFileStorageService'
import {
  createDocument,
  DocumentsServiceError,
  fetchDocuments,
  restoreDocument,
  softDeleteDocument,
  updateDocument,
} from '@/services/documentsService'
import {
  restoreWorkerDocumentSubmission,
  reviewWorkerDocumentSubmission,
  softDeleteWorkerDocumentSubmission,
  updateWorkerDocumentSubmissionMetadata,
  WorkerDocumentSubmissionsServiceError,
} from '@/services/workerDocumentSubmissionsService'
import { fetchDrivers, type Driver } from '@/services/driversService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function parseTab(value: string | null): DocumentsCentreTab {
  if (
    value === 'all' ||
    value === 'company' ||
    value === 'workers' ||
    value === 'vehicles' ||
    value === 'expiring-soon' ||
    value === 'expired'
  ) {
    return value
  }
  return 'all'
}

function defaultAppliesToForTab(tab: DocumentsCentreTab): DocumentAppliesTo {
  if (tab === 'workers') return 'worker'
  if (tab === 'vehicles') return 'vehicle'
  return 'company'
}

function pageModeTabClass(active: boolean): string {
  return [
    'inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#218EE7]/40',
    active
      ? 'bg-white text-[#0B68BE] shadow-sm ring-1 ring-[#C5DFFB]'
      : 'text-[#5499BF] hover:bg-white/70 hover:text-[#0B68BE]',
  ].join(' ')
}

export default function DocumentsPage() {
  const {
    formatDate,
    formatDateTime,
    settings: companySettings,
    weekStarts,
    timezone,
  } = useCompanySettings()
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState<Document[]>([])
  const [workers, setWorkers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [pageMode, setPageMode] = useState<DocumentsPageMode>('worker_uploads')
  const [activeTab, setActiveTab] = useState<DocumentsCentreTab>(() =>
    parseTab(searchParams.get('tab')),
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>('all')
  const [appliesToFilter, setAppliesToFilter] = useState<DocumentAppliesToFilter>('all')
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>('all')
  const [lifecycleFilter, setLifecycleFilter] = useState<DocumentLifecycleFilter>('active')
  const [workerUploadStatusFilter, setWorkerUploadStatusFilter] =
    useState<DocumentWorkerUploadStatusFilter>('pending_review')
  const [workerFilter, setWorkerFilter] = useState(
    () => searchParams.get('workerId') ?? 'all',
  )
  const [vehicleFilter, setVehicleFilter] = useState(
    () => searchParams.get('vehicleId') ?? 'all',
  )
  const [exportDateRange, setExportDateRange] =
    useState<ExportDateRangeSelection>(DEFAULT_EXPORT_DATE_RANGE)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_DOCUMENT_PAGE_SIZE)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editRecord, setEditRecord] = useState<Document | null>(null)
  const [viewRecord, setViewRecord] = useState<Document | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<Document | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [restoreRecord, setRestoreRecord] = useState<Document | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [rejectRecord, setRejectRecord] = useState<Document | null>(null)
  const [editSubmissionRecord, setEditSubmissionRecord] = useState<Document | null>(null)
  const [editSubmissionError, setEditSubmissionError] = useState<string | null>(null)
  const [softDeleteSubmissionRecord, setSoftDeleteSubmissionRecord] =
    useState<Document | null>(null)
  const [softDeleteSubmissionError, setSoftDeleteSubmissionError] = useState<string | null>(
    null,
  )
  const [restoreSubmissionRecord, setRestoreSubmissionRecord] = useState<Document | null>(
    null,
  )
  const [restoreSubmissionError, setRestoreSubmissionError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingSubmission, setIsSavingSubmission] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingSubmission, setIsDeletingSubmission] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isRestoringSubmission, setIsRestoringSubmission] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const isWorkerUploads = pageMode === 'worker_uploads'

  const hasActiveFilters = isWorkerUploads
    ? debouncedSearch.trim().length > 0 || workerUploadStatusFilter !== 'all'
    : activeTab !== 'all' ||
      debouncedSearch.trim().length > 0 ||
      typeFilter !== 'all' ||
      appliesToFilter !== 'all' ||
      statusFilter !== 'all' ||
      lifecycleFilter !== 'active' ||
      workerFilter !== 'all' ||
      vehicleFilter !== 'all'

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [
    pageMode,
    activeTab,
    debouncedSearch,
    typeFilter,
    appliesToFilter,
    statusFilter,
    lifecycleFilter,
    workerUploadStatusFilter,
    workerFilter,
    vehicleFilter,
    pageSize,
  ])

  const loadLookups = useCallback(async () => {
    const [loadedWorkers, loadedVehicles] = await Promise.all([fetchDrivers(), fetchVehicles()])
    setWorkers(loadedWorkers)
    setVehicles(loadedVehicles)
  }, [])

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const loaded = await fetchDocuments()
      setItems(loaded)
    } catch (error) {
      setLoadError(
        error instanceof DocumentsServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load documents',
      )
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!companyReady || !companyId) {
      if (!companyLoading) {
        setIsLoading(false)
        setItems([])
        setWorkers([])
        setVehicles([])
        if (membershipError) {
          setLoadError(membershipError)
        }
      }
      return
    }

    void loadLookups()
    void loadDocuments()
  }, [companyReady, companyId, companyLoading, membershipError, loadDocuments, loadLookups])

  const pendingUploadCount = useMemo(() => countPendingWorkerUploads(items), [items])
  const workerUploadSummaryStats = useMemo(
    () => computeWorkerUploadSummaryStats(items),
    [items],
  )

  const filteredItems = useMemo(
    () =>
      filterDocumentsByQuery(items, {
        pageMode,
        tab: isWorkerUploads ? undefined : activeTab,
        search: debouncedSearch,
        type: isWorkerUploads ? undefined : typeFilter,
        appliesTo: isWorkerUploads ? undefined : appliesToFilter,
        status: isWorkerUploads ? undefined : statusFilter,
        lifecycle: isWorkerUploads ? undefined : lifecycleFilter,
        workerUploadStatusFilter: isWorkerUploads ? workerUploadStatusFilter : undefined,
        workerId: isWorkerUploads ? undefined : workerFilter,
        vehicleId: isWorkerUploads ? undefined : vehicleFilter,
      }),
    [
      activeTab,
      appliesToFilter,
      debouncedSearch,
      isWorkerUploads,
      items,
      lifecycleFilter,
      pageMode,
      statusFilter,
      typeFilter,
      vehicleFilter,
      workerFilter,
      workerUploadStatusFilter,
    ],
  )

  const summaryStats = useMemo(() => computeDocumentSummaryStats(items), [items])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  function handlePageModeChange(mode: DocumentsPageMode) {
    if (mode === pageMode) return
    setPageMode(mode)
    setSearchTerm('')
    setDebouncedSearch('')
  }

  function handleTabChange(tab: DocumentsCentreTab) {
    setActiveTab(tab)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (tab === 'all') {
        next.delete('tab')
      } else {
        next.set('tab', tab)
      }
      return next
    })
  }

  function openCreateModal() {
    setFormMode('create')
    setEditRecord(null)
    setIsFormOpen(true)
  }

  function openEditModal(record: Document) {
    if (isWorkerSubmissionDocument(record)) {
      if (!canEditWorkerSubmission(record)) {
        showToast('Restore this submission before editing.')
        return
      }
      setViewRecord(null)
      setEditSubmissionError(null)
      setEditSubmissionRecord(record)
      return
    }

    if (!canEditDocumentRecord(record)) {
      if (record.workerArchivedAt) {
        showToast('This Worker is archived. Documents cannot be edited until the Worker is restored.')
        return
      }
      if (record.deletedAt) {
        showToast('Restore this document before editing.')
        return
      }
      showToast('This record is managed on the worker profile and cannot be edited here.')
      return
    }
    setViewRecord(null)
    setFormMode('edit')
    setEditRecord(record)
    setIsFormOpen(true)
  }

  function openDeleteModal(record: Document) {
    if (isWorkerSubmissionDocument(record)) {
      if (!canSoftDeleteWorkerSubmission(record)) {
        showToast('This submission cannot be deleted.')
        return
      }
      setSoftDeleteSubmissionError(null)
      setSoftDeleteSubmissionRecord(record)
      return
    }
    setDeleteError(null)
    setDeleteRecord(record)
  }

  function openRestoreRequest(record: Document) {
    if (isWorkerSubmissionDocument(record)) {
      if (!canRestoreWorkerSubmission(record)) {
        showToast('Only archived Worker uploads can be restored.')
        return
      }
      setRestoreSubmissionError(null)
      setRestoreSubmissionRecord(record)
      return
    }
    openRestoreModal(record)
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setTypeFilter('all')
    setAppliesToFilter('all')
    setStatusFilter('all')
    setLifecycleFilter('active')
    setWorkerUploadStatusFilter('pending_review')
    setWorkerFilter('all')
    setVehicleFilter('all')
  }

  async function handleMarkReviewed(record: Document) {
    const submissionId = record.submissionId?.trim()
    if (!submissionId) {
      showToast('Submission could not be reviewed.')
      return
    }

    setIsReviewing(true)
    try {
      await reviewWorkerDocumentSubmission({
        submissionId,
        reviewStatus: 'reviewed',
      })
      showToast('Marked as reviewed')
      setViewRecord(null)
      await loadDocuments()
    } catch (error) {
      showToast(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : 'Unable to mark as reviewed.',
      )
    } finally {
      setIsReviewing(false)
    }
  }

  async function handleRejectConfirm(reason: string) {
    const submissionId = rejectRecord?.submissionId?.trim()
    if (!submissionId) {
      showToast('Submission could not be rejected.')
      return
    }

    setIsReviewing(true)
    try {
      await reviewWorkerDocumentSubmission({
        submissionId,
        reviewStatus: 'rejected',
        rejectionReason: reason,
      })
      showToast('Submission rejected')
      setRejectRecord(null)
      setViewRecord(null)
      await loadDocuments()
    } catch (error) {
      showToast(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : 'Unable to reject submission.',
      )
    } finally {
      setIsReviewing(false)
    }
  }

  async function handleOpenFile(record: Document) {
    const path = getDocumentStoragePath(record)
    if (!path) {
      showToast('Only the expiry record exists — no file has been uploaded.')
      return
    }

    try {
      const url = await getDocumentFileSignedUrl(path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      showToast(
        error instanceof DocumentFileStorageError
          ? error.message
          : 'Unable to open file.',
      )
    }
  }

  async function handleDownloadSubmissionFile(record: Document) {
    const attachments = [...(record.attachments ?? [])].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    )
    const attachment = attachments[0]
    if (!attachment) {
      showToast('No file is available to download.')
      return
    }

    try {
      await downloadWorkerSubmissionOriginalFile({
        filePath: attachment.filePath,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
      })
    } catch (error) {
      showToast(toExportUserMessage(error, 'Unable to download file.'))
    }
  }

  async function handleDownloadSubmissionZip(record: Document) {
    if (isExporting) return
    setIsExporting(true)
    try {
      await downloadWorkerSubmissionZip(record)
      showToast('Downloaded files as ZIP')
    } catch (error) {
      showToast(toExportUserMessage(error, 'Unable to download files.'))
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDownloadManagedFile(record: Document) {
    try {
      await downloadManagedDocumentOriginalFile(record)
    } catch (error) {
      showToast(toExportUserMessage(error, 'Unable to download file.'))
    }
  }

  function handleView(record: Document) {
    setViewRecord(record)
  }

  function openRestoreModal(record: Document) {
    if (!canRestoreDocumentRecord(record)) {
      if (record.workerArchivedAt) {
        showToast(
          'This document belongs to an archived Worker and cannot be restored until the Worker is restored.',
        )
        return
      }
      showToast('Only manually deleted documents can be restored.')
      return
    }
    setRestoreRecord(record)
  }

  async function handleFormSubmit(payload: DocumentFormSubmitPayload) {
    setIsSaving(true)
    const companyId = companySettings?.id
    const allowMedicalUploads = companySettings?.allowMedicalDocumentUploads === true
    const input = documentFormValuesToInput(payload.values)

    try {
      if (isMedicalDocumentType(input.documentType) && !allowMedicalUploads) {
        if (!editRecord || payload.file || payload.removeFile) {
          throw new DocumentsServiceError(
            'Medical document uploads are disabled. Enable “Allow medical document uploads” in Settings → Documents.',
          )
        }
      }

      if (formMode === 'create') {
        const created = await createDocument(input)

        if (companyId && payload.file) {
          const filePath = await applyDocumentFileChanges({
            companyId,
            documentId: created.id,
            existingFilePath: null,
            file: payload.file,
            removeFile: false,
          })
          await updateDocument(created.id, { filePath })
        }

        showToast('Document added')
      } else if (editRecord) {
        // Persist metadata first, then attachment changes.
        await updateDocument(editRecord.id, input)

        if (companyId && payload.removeFile && !payload.file) {
          const filePath = await applyDocumentFileChanges({
            companyId,
            documentId: editRecord.id,
            existingFilePath: editRecord.filePath ?? editRecord.fileUrl,
            file: null,
            removeFile: true,
          })
          await updateDocument(editRecord.id, { filePath })
        } else if (companyId && payload.file) {
          // Upload new file first; only then point the row at it.
          // Do not delete the previous Storage object in this task.
          const filePath = await uploadDocumentFile(companyId, editRecord.id, payload.file)
          await updateDocument(editRecord.id, { filePath })
        }

        showToast('Document updated')
      }

      await loadDocuments()
    } catch (error) {
      if (error instanceof DocumentFileStorageError) throw error
      throw error instanceof DocumentsServiceError
        ? error
        : new DocumentsServiceError('Failed to save document')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteRecord) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await softDeleteDocument(deleteRecord.id, deleteRecord.source ?? 'documents')
      showToast('Document archived')
      setDeleteRecord(null)
      await loadDocuments()
    } catch (error) {
      setDeleteError(
        error instanceof DocumentsServiceError
          ? error.message
          : 'Unable to archive document.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRestoreConfirm() {
    if (!restoreRecord) return

    setIsRestoring(true)
    setRestoreError(null)

    try {
      await restoreDocument(restoreRecord.id)
      showToast('Document restored')
      setRestoreRecord(null)
      await loadDocuments()
    } catch (error) {
      setRestoreError(
        error instanceof DocumentsServiceError
          ? error.message
          : 'Unable to restore document.',
      )
    } finally {
      setIsRestoring(false)
    }
  }

  async function handleEditSubmissionSubmit(values: {
    documentType: WorkerSubmissionDocumentType
    customDocumentName: string
    referenceNumber: string
    notes: string
  }) {
    const submissionId = editSubmissionRecord?.submissionId?.trim()
    if (!submissionId) {
      setEditSubmissionError('Submission could not be updated.')
      return
    }

    setIsSavingSubmission(true)
    setEditSubmissionError(null)
    try {
      await updateWorkerDocumentSubmissionMetadata({
        submissionId,
        values: {
          documentType: values.documentType,
          customDocumentName: values.customDocumentName,
          referenceNumber: values.referenceNumber,
          notes: values.notes,
        },
      })
      showToast('Worker upload updated')
      setEditSubmissionRecord(null)
      await loadDocuments()
    } catch (error) {
      setEditSubmissionError(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : 'Unable to update submission.',
      )
    } finally {
      setIsSavingSubmission(false)
    }
  }

  async function handleSoftDeleteSubmissionConfirm(reason: string) {
    const submissionId = softDeleteSubmissionRecord?.submissionId?.trim()
    if (!submissionId) {
      setSoftDeleteSubmissionError('Submission could not be archived.')
      return
    }

    setIsDeletingSubmission(true)
    setSoftDeleteSubmissionError(null)
    try {
      await softDeleteWorkerDocumentSubmission({
        submissionId,
        deleteReason: reason,
      })
      showToast('Worker upload archived')
      setSoftDeleteSubmissionRecord(null)
      setViewRecord(null)
      await loadDocuments()
    } catch (error) {
      setSoftDeleteSubmissionError(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : 'Unable to archive submission.',
      )
    } finally {
      setIsDeletingSubmission(false)
    }
  }

  async function handleRestoreSubmissionConfirm() {
    const submissionId = restoreSubmissionRecord?.submissionId?.trim()
    if (!submissionId) {
      setRestoreSubmissionError('Submission could not be restored.')
      return
    }

    setIsRestoringSubmission(true)
    setRestoreSubmissionError(null)
    try {
      await restoreWorkerDocumentSubmission(submissionId)
      showToast('Worker upload restored')
      setRestoreSubmissionRecord(null)
      setViewRecord(null)
      await loadDocuments()
    } catch (error) {
      setRestoreSubmissionError(
        error instanceof WorkerDocumentSubmissionsServiceError
          ? error.message
          : 'Unable to restore submission.',
      )
    } finally {
      setIsRestoringSubmission(false)
    }
  }

  const showEmptyState =
    !isLoading &&
    !loadError &&
    !isWorkerUploads &&
    items.filter((doc) => doc.source !== 'worker_submission').length === 0 &&
    !hasActiveFilters

  return (
    <AdminLayout premiumBackground wideContent>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#218EE7]">
            Compliance
          </p>
          <h1 className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>
            Documents
          </h1>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${adminTextMuted}`}>
            Review Worker uploads and manage company, worker and vehicle compliance documents.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Documents views"
          className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-[#C5DFFB] bg-[#E8F3FE]/90 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isWorkerUploads}
            id="documents-tab-worker-uploads"
            onClick={() => handlePageModeChange('worker_uploads')}
            className={pageModeTabClass(isWorkerUploads)}
          >
            Worker Uploads
            {pendingUploadCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                {pendingUploadCount} Pending
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isWorkerUploads}
            id="documents-tab-managed"
            onClick={() => handlePageModeChange('managed')}
            className={pageModeTabClass(!isWorkerUploads)}
          >
            Managed Documents
          </button>
        </div>

        {isWorkerUploads ? (
          <WorkerUploadSummaryCards
            stats={workerUploadSummaryStats}
            isLoading={isLoading}
            activeFilter={workerUploadStatusFilter}
            onSelect={setWorkerUploadStatusFilter}
          />
        ) : (
          <DocumentsSummaryCards
            stats={summaryStats}
            isLoading={isLoading}
            activeTab={activeTab}
            onSelect={handleTabChange}
          />
        )}

        <DocumentsToolbar
          key={pageMode}
          pageMode={pageMode}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          appliesToFilter={appliesToFilter}
          onAppliesToFilterChange={setAppliesToFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          lifecycleFilter={lifecycleFilter}
          onLifecycleFilterChange={setLifecycleFilter}
          workerUploadStatusFilter={workerUploadStatusFilter}
          onWorkerUploadStatusFilterChange={setWorkerUploadStatusFilter}
          workerFilter={workerFilter}
          onWorkerFilterChange={setWorkerFilter}
          vehicleFilter={vehicleFilter}
          onVehicleFilterChange={setVehicleFilter}
          workers={workers}
          vehicles={vehicles}
          onClearFilters={clearFilters}
          onAddDocument={openCreateModal}
          secondaryActions={
            isWorkerUploads ? (
              <ExportMenu
                busy={isExporting}
                busyLabel="Preparing download…"
                disabled={isLoading}
                actions={[
                  {
                    id: 'csv',
                    label: 'Export list (.csv)',
                    onSelect: async () => {
                      setIsExporting(true)
                      try {
                        exportWorkerUploadsCsv(filteredItems)
                        showToast('Exported Worker uploads list')
                      } catch (error) {
                        showToast(toExportUserMessage(error))
                      } finally {
                        setIsExporting(false)
                      }
                    },
                  },
                  {
                    id: 'zip',
                    label: 'Download files (.zip)',
                    disabled: countDownloadableDocumentFiles(filteredItems) === 0,
                    onSelect: async () => {
                      if (countDownloadableDocumentFiles(filteredItems) === 0) {
                        showToast('No files available to download')
                        return
                      }
                      setIsExporting(true)
                      try {
                        await downloadFilteredDocumentsZip(
                          filteredItems,
                          'worker_uploads',
                        )
                        showToast('Downloaded Worker upload files')
                      } catch (error) {
                        showToast(toExportUserMessage(error))
                      } finally {
                        setIsExporting(false)
                      }
                    },
                  },
                ]}
              />
            ) : (
              <ExportMenu
                busy={isExporting}
                busyLabel="Preparing download…"
                disabled={isLoading}
                dateRange={exportDateRange}
                onDateRangeChange={setExportDateRange}
                actions={[
                  {
                    id: 'csv',
                    label: 'Export list (.csv)',
                    onSelect: async () => {
                      setIsExporting(true)
                      try {
                        const resolvedRange = resolveExportDateRange(exportDateRange, {
                          weekStarts,
                          timeZone: timezone,
                          formatDate,
                        })
                        const exportItems = filteredItems.filter((document) =>
                          rowMatchesExportDateRange(document.expiryDate, resolvedRange),
                        )
                        exportManagedDocumentsCsv(exportItems)
                        showToast('Exported Managed Documents list')
                      } catch (error) {
                        showToast(toExportUserMessage(error))
                      } finally {
                        setIsExporting(false)
                      }
                    },
                  },
                  {
                    id: 'zip',
                    label: 'Download files (.zip)',
                    disabled: (() => {
                      const resolvedRange = resolveExportDateRange(exportDateRange, {
                        weekStarts,
                        timeZone: timezone,
                        formatDate,
                      })
                      const exportItems = filteredItems.filter((document) =>
                        rowMatchesExportDateRange(document.expiryDate, resolvedRange),
                      )
                      return countDownloadableDocumentFiles(exportItems) === 0
                    })(),
                    onSelect: async () => {
                      const resolvedRange = resolveExportDateRange(exportDateRange, {
                        weekStarts,
                        timeZone: timezone,
                        formatDate,
                      })
                      const exportItems = filteredItems.filter((document) =>
                        rowMatchesExportDateRange(document.expiryDate, resolvedRange),
                      )
                      if (countDownloadableDocumentFiles(exportItems) === 0) {
                        showToast('No files available to download')
                        return
                      }
                      setIsExporting(true)
                      try {
                        await downloadFilteredDocumentsZip(exportItems, 'managed')
                        showToast('Downloaded Managed Document files')
                      } catch (error) {
                        showToast(toExportUserMessage(error))
                      } finally {
                        setIsExporting(false)
                      }
                    },
                  },
                ]}
              />
            )
          }
        />

        {loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className={`px-6 py-10 text-center text-sm text-[#5499BF] ${documentPageCardClass}`}>
            Loading documents…
          </div>
        ) : showEmptyState ? (
          <DocumentsEmptyState
            hasActiveFilters={false}
            pageMode={pageMode}
            onAddFirst={openCreateModal}
          />
        ) : filteredItems.length === 0 ? (
          <DocumentsEmptyState
            hasActiveFilters={hasActiveFilters}
            activeTab={activeTab}
            pageMode={pageMode}
            workerUploadStatusFilter={workerUploadStatusFilter}
            onAddFirst={openCreateModal}
          />
        ) : (
          <div className={documentPageCardClass}>
            <DocumentsDataTable
              documents={paginatedItems}
              pageMode={pageMode}
              tab={activeTab}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              onView={handleView}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onRestore={openRestoreRequest}
              onOpenFile={(record) => void handleOpenFile(record)}
              onDownloadSubmissionFile={(record) =>
                void handleDownloadSubmissionFile(record)
              }
              onDownloadSubmissionZip={(record) =>
                void handleDownloadSubmissionZip(record)
              }
              onDownloadManagedFile={(record) =>
                void handleDownloadManagedFile(record)
              }
              onMarkReviewed={(record) => void handleMarkReviewed(record)}
              onReject={setRejectRecord}
            />
            <DocumentsPagination
              page={page}
              pageSize={pageSize}
              totalCount={filteredItems.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      <DocumentFormModal
        isOpen={isFormOpen}
        mode={formMode}
        record={editRecord}
        workers={workers}
        vehicles={vehicles}
        defaultAppliesTo={defaultAppliesToForTab(activeTab)}
        defaultWorkerId={workerFilter !== 'all' ? workerFilter : undefined}
        defaultVehicleId={vehicleFilter !== 'all' ? vehicleFilter : undefined}
        allowMedicalDocumentUploads={companySettings?.allowMedicalDocumentUploads === true}
        isSaving={isSaving}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      <DocumentDrawer
        record={viewRecord}
        isOpen={Boolean(viewRecord)}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        onClose={() => setViewRecord(null)}
        onEdit={openEditModal}
        onOpenFile={(record) => void handleOpenFile(record)}
        onMarkReviewed={(record) => void handleMarkReviewed(record)}
        onReject={setRejectRecord}
      />

      <RejectWorkerSubmissionModal
        key={rejectRecord?.id ?? 'reject-closed'}
        record={rejectRecord}
        isOpen={Boolean(rejectRecord)}
        isSubmitting={isReviewing}
        onClose={() => setRejectRecord(null)}
        onConfirm={(reason) => void handleRejectConfirm(reason)}
      />

      <EditWorkerSubmissionModal
        key={editSubmissionRecord?.id ?? 'edit-submission-closed'}
        record={editSubmissionRecord}
        isOpen={Boolean(editSubmissionRecord)}
        isSaving={isSavingSubmission}
        errorMessage={editSubmissionError}
        formatDateTime={formatDateTime}
        onClose={() => {
          setEditSubmissionRecord(null)
          setEditSubmissionError(null)
        }}
        onSubmit={(values) => void handleEditSubmissionSubmit(values)}
      />

      <SoftDeleteWorkerSubmissionModal
        key={softDeleteSubmissionRecord?.id ?? 'soft-delete-closed'}
        record={softDeleteSubmissionRecord}
        isOpen={Boolean(softDeleteSubmissionRecord)}
        isDeleting={isDeletingSubmission}
        errorMessage={softDeleteSubmissionError}
        onCancel={() => {
          setSoftDeleteSubmissionRecord(null)
          setSoftDeleteSubmissionError(null)
        }}
        onConfirm={(reason) => void handleSoftDeleteSubmissionConfirm(reason)}
      />

      <RestoreWorkerSubmissionModal
        key={restoreSubmissionRecord?.id ?? 'restore-submission-closed'}
        record={restoreSubmissionRecord}
        isOpen={Boolean(restoreSubmissionRecord)}
        isRestoring={isRestoringSubmission}
        errorMessage={restoreSubmissionError}
        onCancel={() => {
          setRestoreSubmissionRecord(null)
          setRestoreSubmissionError(null)
        }}
        onConfirm={() => void handleRestoreSubmissionConfirm()}
      />

      {deleteRecord ? (
        <DeleteDocumentModal
          record={deleteRecord}
          errorMessage={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            setDeleteRecord(null)
            setDeleteError(null)
          }}
          onConfirm={() => void handleDeleteConfirm()}
        />
      ) : null}

      {restoreRecord ? (
        <RestoreDocumentModal
          record={restoreRecord}
          errorMessage={restoreError}
          isRestoring={isRestoring}
          onCancel={() => {
            setRestoreRecord(null)
            setRestoreError(null)
          }}
          onConfirm={() => void handleRestoreConfirm()}
        />
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[140] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}
