import { DeleteDocumentModal } from '@/components/documents/DeleteDocumentModal'
import {
  DocumentFormModal,
  documentFormValuesToInput,
} from '@/components/documents/DocumentFormModal'
import { getDocumentStoragePath } from '@/components/documents/DocumentFileField'
import { DocumentsDataTable } from '@/components/documents/DocumentsDataTable'
import { DocumentsEmptyState } from '@/components/documents/DocumentsEmptyState'
import { DocumentsPagination } from '@/components/documents/DocumentsPagination'
import { DocumentsSummaryCards } from '@/components/documents/DocumentsSummaryCards'
import { DocumentsToolbar } from '@/components/documents/DocumentsToolbar'
import { documentPageCardClass } from '@/components/documents/documentUiStyles'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  Document,
  DocumentAppliesTo,
  DocumentAppliesToFilter,
  DocumentFormSubmitPayload,
  DocumentsCentreTab,
  DocumentStatusFilter,
  DocumentTypeFilter,
} from '@/lib/documentTypes'
import { DEFAULT_DOCUMENT_PAGE_SIZE } from '@/lib/documentTypes'
import { isMedicalDocumentType } from '@/lib/documentTypes'
import {
  computeDocumentSummaryStats,
  filterDocumentsByQuery,
  getDocumentViewTarget,
} from '@/lib/documentUtils'
import { adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import {
  applyDocumentFileChanges,
  deleteDocumentFile,
  DocumentFileStorageError,
  getDocumentFileSignedUrl,
} from '@/services/documentFileStorageService'
import {
  createDocument,
  deleteDocument,
  DocumentsServiceError,
  fetchDocuments,
  updateDocument,
} from '@/services/documentsService'
import { fetchDrivers, type Driver } from '@/services/driversService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

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

export default function DocumentsPage() {
  const navigate = useNavigate()
  const { formatDate, settings: companySettings } = useCompanySettings()
  const { companyReady, companyId, companyLoading, membershipError } = useCompanyTenantGate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState<Document[]>([])
  const [workers, setWorkers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<DocumentsCentreTab>(() =>
    parseTab(searchParams.get('tab')),
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>('all')
  const [appliesToFilter, setAppliesToFilter] = useState<DocumentAppliesToFilter>('all')
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>('all')
  const [workerFilter, setWorkerFilter] = useState(
    () => searchParams.get('workerId') ?? 'all',
  )
  const [vehicleFilter, setVehicleFilter] = useState(
    () => searchParams.get('vehicleId') ?? 'all',
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_DOCUMENT_PAGE_SIZE)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editRecord, setEditRecord] = useState<Document | null>(null)
  const [deleteRecord, setDeleteRecord] = useState<Document | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const hasActiveFilters =
    activeTab !== 'all' ||
    debouncedSearch.trim().length > 0 ||
    typeFilter !== 'all' ||
    appliesToFilter !== 'all' ||
    statusFilter !== 'all' ||
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
    activeTab,
    debouncedSearch,
    typeFilter,
    appliesToFilter,
    statusFilter,
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

  const filteredItems = useMemo(
    () =>
      filterDocumentsByQuery(items, {
        tab: activeTab,
        search: debouncedSearch,
        type: typeFilter,
        appliesTo: appliesToFilter,
        status: statusFilter,
        workerId: workerFilter,
        vehicleId: vehicleFilter,
      }),
    [
      activeTab,
      appliesToFilter,
      debouncedSearch,
      items,
      statusFilter,
      typeFilter,
      vehicleFilter,
      workerFilter,
    ],
  )

  const summaryStats = useMemo(() => computeDocumentSummaryStats(items), [items])

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

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
    setFormMode('edit')
    setEditRecord(record)
    setIsFormOpen(true)
  }

  function clearFilters() {
    setSearchTerm('')
    setDebouncedSearch('')
    setTypeFilter('all')
    setAppliesToFilter('all')
    setStatusFilter('all')
    setWorkerFilter('all')
    setVehicleFilter('all')
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

  function handleView(record: Document) {
    const target = getDocumentViewTarget(record)

    if (target.kind === 'file') {
      void handleOpenFile(record)
      return
    }

    if (target.kind === 'worker') {
      navigate(`/drivers/${target.workerId}`)
      return
    }

    if (target.kind === 'vehicle') {
      navigate(`/vehicles/${target.vehicleId}?tab=documents`)
      return
    }

    showToast('Only the expiry record exists — no file has been uploaded.')
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
        await updateDocument(editRecord.id, input)

        if (companyId && (payload.file || payload.removeFile)) {
          const filePath = await applyDocumentFileChanges({
            companyId,
            documentId: editRecord.id,
            existingFilePath: editRecord.filePath ?? editRecord.fileUrl,
            file: payload.file,
            removeFile: payload.removeFile,
          })
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
      const path = getDocumentStoragePath(deleteRecord)
      if (path) {
        try {
          await deleteDocumentFile(path)
        } catch {
          /* continue delete */
        }
      }

      await deleteDocument(deleteRecord.id, deleteRecord.source ?? 'documents')
      showToast('Document deleted')
      setDeleteRecord(null)
      await loadDocuments()
    } catch (error) {
      setDeleteError(
        error instanceof DocumentsServiceError
          ? error.message
          : 'Unable to delete document.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const showEmptyState = !isLoading && !loadError && items.length === 0 && !hasActiveFilters

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
            Manage company, worker and vehicle documents in one place.
          </p>
        </div>

        <DocumentsSummaryCards
          stats={summaryStats}
          isLoading={isLoading}
          activeTab={activeTab}
          onSelect={handleTabChange}
        />

        <DocumentsToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          appliesToFilter={appliesToFilter}
          onAppliesToFilterChange={setAppliesToFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          workerFilter={workerFilter}
          onWorkerFilterChange={setWorkerFilter}
          vehicleFilter={vehicleFilter}
          onVehicleFilterChange={setVehicleFilter}
          workers={workers}
          vehicles={vehicles}
          onClearFilters={clearFilters}
          onAddDocument={openCreateModal}
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
          <DocumentsEmptyState hasActiveFilters={false} onAddFirst={openCreateModal} />
        ) : filteredItems.length === 0 ? (
          <DocumentsEmptyState
            hasActiveFilters={hasActiveFilters}
            activeTab={activeTab}
            onAddFirst={openCreateModal}
          />
        ) : (
          <div className={documentPageCardClass}>
            <DocumentsDataTable
              documents={paginatedItems}
              tab={activeTab}
              formatDate={formatDate}
              onView={handleView}
              onEdit={openEditModal}
              onDelete={setDeleteRecord}
              onOpenFile={(record) => void handleOpenFile(record)}
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

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[140] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}
