import { AddComplianceRecordModal } from '@/components/compliance/AddComplianceRecordModal'
import { ComplianceDocumentsTable } from '@/components/compliance/ComplianceDocumentsTable'
import { ComplianceProfileTabBar } from '@/components/compliance/ComplianceProfileTabBar'
import { EditComplianceRecordModal } from '@/components/compliance/EditComplianceRecordModal'
import { Button } from '@/components/ui/button'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  ComplianceDocumentItem,
  ComplianceProfileTab,
  ComplianceRecordFormInput,
  WorkerComplianceRecord,
} from '@/lib/complianceTypes'
import {
  buildWorkerDocuments,
  computeComplianceScore,
  getScoreRingTone,
  getScoreTone,
  getSuggestedDocumentTypes,
  getWorkerInitials,
  getWorkerName,
} from '@/lib/complianceUtils'
import { fetchDriverById, fetchDrivers, type Driver } from '@/services/driversService'
import {
  createWorkerComplianceRecord,
  deleteWorkerComplianceRecord,
  fetchWorkerComplianceRecordById,
  fetchWorkerComplianceRecordsByWorkerId,
  updateWorkerComplianceRecord,
  WorkerComplianceServiceError,
} from '@/services/workerComplianceService'
import { ArrowLeft, FileText, Mail, Phone, Plus, Shield } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

function parseProfileTab(value: string | null): ComplianceProfileTab {
  if (value === 'overview' || value === 'documents' || value === 'history') return value
  return 'compliance'
}

export default function WorkerComplianceProfilePage() {
  const { workerId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseProfileTab(searchParams.get('tab'))

  const [worker, setWorker] = useState<Driver | null>(null)
  const [records, setRecords] = useState<WorkerComplianceRecord[]>([])
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<WorkerComplianceRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const loadData = useCallback(async () => {
    if (!workerId) return
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [loadedWorker, loadedRecords, loadedDrivers] = await Promise.all([
        fetchDriverById(workerId),
        fetchWorkerComplianceRecordsByWorkerId(workerId),
        fetchDrivers(),
      ])

      if (!loadedWorker) {
        setErrorMessage('Worker not found.')
        return
      }

      setWorker(loadedWorker)
      setRecords(loadedRecords)
      setAllDrivers(loadedDrivers)
    } catch (error) {
      setErrorMessage(
        error instanceof WorkerComplianceServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load worker compliance profile',
      )
    } finally {
      setIsLoading(false)
    }
  }, [workerId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const documents = useMemo(
    () => (worker ? buildWorkerDocuments(worker.id, records, allDrivers) : []),
    [allDrivers, records, worker],
  )

  const complianceScore = useMemo(
    () =>
      worker
        ? computeComplianceScore(documents, getSuggestedDocumentTypes(worker.role))
        : 0,
    [documents, worker],
  )

  const counts = useMemo(() => {
    return {
      valid: documents.filter((doc) => doc.status === 'Valid').length,
      expiring: documents.filter((doc) => doc.status === 'Expiring Soon').length,
      expired: documents.filter((doc) => doc.status === 'Expired').length,
    }
  }, [documents])

  const suggestedMissing = useMemo(() => {
    if (!worker) return []
    const present = new Set(documents.map((doc) => doc.documentType))
    return getSuggestedDocumentTypes(worker.role).filter((type) => !present.has(type))
  }, [documents, worker])

  function handleTabChange(tab: ComplianceProfileTab) {
    setSearchParams({ tab })
  }

  async function handleCreate(input: ComplianceRecordFormInput) {
    setIsSaving(true)
    try {
      await createWorkerComplianceRecord({
        workerId: input.workerId,
        documentType: input.documentType,
        documentName: input.documentName || null,
        issueDate: input.issueDate || null,
        expiryDate: input.expiryDate || null,
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
      })
      showToast('Compliance record added')
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(input: ComplianceRecordFormInput) {
    if (!editRecord) return
    setIsSaving(true)
    try {
      await updateWorkerComplianceRecord(editRecord.id, {
        workerId: input.workerId,
        documentType: input.documentType,
        documentName: input.documentName || null,
        issueDate: input.issueDate || null,
        expiryDate: input.expiryDate || null,
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
      })
      showToast('Compliance record updated')
      setEditRecord(null)
      await loadData()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleEditDocument(document: ComplianceDocumentItem) {
    if (!document.canEdit || document.source !== 'worker_record') return
    try {
      const record = await fetchWorkerComplianceRecordById(document.id)
      if (!record) {
        showToast('Record not found')
        return
      }
      setEditRecord(record)
    } catch {
      showToast('Failed to load record')
    }
  }

  async function handleDeleteDocument(document: ComplianceDocumentItem) {
    if (!document.canDelete) return
    const confirmed = window.confirm(`Delete ${document.documentType} record?`)
    if (!confirmed) return

    setIsSaving(true)
    try {
      await deleteWorkerComplianceRecord(document.id)
      showToast('Compliance record deleted')
      await loadData()
    } catch {
      showToast('Failed to delete record')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="h-48 animate-pulse rounded-[22px] bg-white ring-1 ring-blue-100/70" />
      </AdminLayout>
    )
  }

  if (errorMessage || !worker) {
    return (
      <AdminLayout>
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <p className="text-lg font-semibold text-slate-950">{errorMessage ?? 'Worker not found'}</p>
          <Button asChild className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white hover:bg-[#2563EB]">
            <Link to="/documents">Back to Documents</Link>
          </Button>
        </div>
      </AdminLayout>
    )
  }

  const workerName = getWorkerName(worker)

  return (
    <AdminLayout>
      <section className="rounded-[28px] bg-white/75 p-5 shadow-[0_24px_70px_rgba(59,130,246,0.10)] ring-1 ring-white/70 backdrop-blur-xl sm:p-6">
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8]"
        >
          <ArrowLeft className="size-4" />
          Back to Documents Centre
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-[#EAF4FF] text-lg font-semibold text-[#2563EB] ring-2 ring-blue-100">
              {worker.avatarUrl ? (
                <img src={worker.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                getWorkerInitials(worker)
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{workerName}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{worker.role}</p>
              <p className="text-sm text-slate-400">{worker.assignment ?? worker.company ?? '—'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${getScoreRingTone(complianceScore)} ${getScoreTone(complianceScore)}`}
            >
              Compliance Score {complianceScore}%
            </span>
            <ComplianceProfileTabBar activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </div>
      </section>

      {activeTab === 'overview' ? (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Valid Documents', value: counts.valid, tone: 'text-emerald-700' },
            { label: 'Expiring Soon', value: counts.expiring, tone: 'text-amber-700' },
            { label: 'Expired', value: counts.expired, tone: 'text-rose-700' },
            { label: 'Compliance Score', value: `${complianceScore}%`, tone: getScoreTone(complianceScore) },
          ].map((card) => (
            <div key={card.label} className="rounded-[20px] bg-white p-5 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
              <p className="text-sm font-semibold text-slate-500">{card.label}</p>
              <p className={`mt-3 text-3xl font-semibold tracking-[-0.05em] ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === 'overview' ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[20px] bg-white p-5 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-400">Contact</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-2"><Mail className="size-4 text-slate-400" />{worker.email}</p>
              <p className="flex items-center gap-2"><Phone className="size-4 text-slate-400" />{worker.phone ?? '—'}</p>
            </div>
          </div>
          <div className="rounded-[20px] bg-white p-5 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-400">Recommended Documents</h2>
            {suggestedMissing.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {suggestedMissing.map((type) => (
                  <li key={type} className="flex items-center gap-2">
                    <Shield className="size-4 text-amber-500" />
                    {type} — not recorded
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">All recommended documents for this role are recorded.</p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === 'compliance' ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="h-10 rounded-[14px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              <Plus className="mr-1.5 size-4" />
              Add Compliance Record
            </Button>
          </div>
          {documents.length === 0 ? (
            <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
              <p className="text-lg font-semibold text-slate-950">No compliance records yet</p>
              <p className="mt-2 text-sm text-slate-500">Add licences, training and certifications for this worker.</p>
            </div>
          ) : (
            <ComplianceDocumentsTable
              documents={documents}
              onEdit={(doc) => void handleEditDocument(doc)}
              onDelete={(doc) => void handleDeleteDocument(doc)}
              onUploadPlaceholder={() => showToast('Document upload will be available in a future release')}
            />
          )}
        </>
      ) : null}

      {activeTab === 'documents' ? (
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <FileText className="mx-auto size-10 text-slate-300" />
          <p className="mt-4 text-lg font-semibold text-slate-950">Document files</p>
          <p className="mt-2 text-sm text-slate-500">
            File uploads and document storage will be available in a future release.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/drivers/${worker.id}`)}
            className="mt-4 text-[#2563EB]"
          >
            View worker profile
          </Button>
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
          <p className="text-lg font-semibold text-slate-950">Compliance history</p>
          <p className="mt-2 text-sm text-slate-500">
            Audit trail and change history will be available in a future release.
          </p>
        </div>
      ) : null}

      <AddComplianceRecordModal
        isOpen={isAddModalOpen}
        workers={allDrivers}
        defaultWorkerId={worker.id}
        isSaving={isSaving}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
      />

      <EditComplianceRecordModal
        record={editRecord}
        workers={allDrivers}
        isOpen={editRecord !== null}
        isSaving={isSaving}
        onClose={() => setEditRecord(null)}
        onSubmit={handleUpdate}
      />

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[60] rounded-[12px] bg-[#2A376F] px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </AdminLayout>
  )
}
