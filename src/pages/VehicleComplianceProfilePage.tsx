import { AddVehicleComplianceRecordModal } from '@/components/compliance/AddVehicleComplianceRecordModal'
import { ComplianceDocumentsTable } from '@/components/compliance/ComplianceDocumentsTable'
import { ComplianceProfileTabBar } from '@/components/compliance/ComplianceProfileTabBar'
import { EditVehicleComplianceRecordModal } from '@/components/compliance/EditVehicleComplianceRecordModal'
import { Button } from '@/components/ui/button'
import AdminLayout from '@/layouts/AdminLayout'
import type {
  ComplianceDocumentItem,
  ComplianceProfileTab,
  VehicleComplianceRecord,
  VehicleComplianceRecordFormInput,
} from '@/lib/complianceTypes'
import {
  buildVehicleDocuments,
  computeComplianceScore,
  getScoreRingTone,
  getScoreTone,
  getVehicleName,
} from '@/lib/complianceUtils'
import {
  createVehicleComplianceRecord,
  deleteVehicleComplianceRecord,
  fetchVehicleComplianceRecordsByVehicleId,
  updateVehicleComplianceRecord,
  VehicleComplianceServiceError,
} from '@/services/vehicleComplianceService'
import { fetchVehicleById, fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import { ArrowLeft, FileText, Plus, Truck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

function parseProfileTab(value: string | null): ComplianceProfileTab {
  if (value === 'overview' || value === 'documents' || value === 'history') return value
  return 'compliance'
}

export default function VehicleComplianceProfilePage() {
  const { vehicleId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseProfileTab(searchParams.get('tab'))

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [records, setRecords] = useState<VehicleComplianceRecord[]>([])
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<VehicleComplianceRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2800)
  }, [])

  const loadData = useCallback(async () => {
    if (!vehicleId) return
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [loadedVehicle, loadedRecords, loadedVehicles] = await Promise.all([
        fetchVehicleById(vehicleId),
        fetchVehicleComplianceRecordsByVehicleId(vehicleId),
        fetchVehicles(),
      ])

      if (!loadedVehicle) {
        setErrorMessage('Vehicle not found.')
        return
      }

      setVehicle(loadedVehicle)
      setRecords(loadedRecords)
      setAllVehicles(loadedVehicles)
    } catch (error) {
      setErrorMessage(
        error instanceof VehicleComplianceServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load vehicle compliance profile',
      )
    } finally {
      setIsLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const documents = useMemo(
    () => (vehicle ? buildVehicleDocuments(vehicle.id, records, allVehicles) : []),
    [allVehicles, records, vehicle],
  )

  const complianceScore = useMemo(() => computeComplianceScore(documents), [documents])

  const counts = useMemo(() => {
    return {
      valid: documents.filter((doc) => doc.status === 'Valid').length,
      expiring: documents.filter((doc) => doc.status === 'Expiring Soon').length,
      expired: documents.filter((doc) => doc.status === 'Expired').length,
    }
  }, [documents])

  function handleTabChange(tab: ComplianceProfileTab) {
    setSearchParams({ tab })
  }

  async function handleCreate(input: VehicleComplianceRecordFormInput) {
    setIsSaving(true)
    try {
      await createVehicleComplianceRecord({
        vehicleId: input.vehicleId,
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

  async function handleUpdate(input: VehicleComplianceRecordFormInput) {
    if (!editRecord) return
    setIsSaving(true)
    try {
      await updateVehicleComplianceRecord(editRecord.id, {
        vehicleId: input.vehicleId,
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

  function handleEditDocument(document: ComplianceDocumentItem) {
    if (!document.canEdit || document.source !== 'vehicle_record') return
    const record = records.find((item) => item.id === document.id)
    if (record) setEditRecord(record)
  }

  async function handleDeleteDocument(document: ComplianceDocumentItem) {
    if (!document.canDelete) return
    const confirmed = window.confirm(`Delete ${document.documentType} record?`)
    if (!confirmed) return

    setIsSaving(true)
    try {
      await deleteVehicleComplianceRecord(document.id)
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
        <div className="h-48 animate-pulse rounded-[22px] bg-white ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10" />
      </AdminLayout>
    )
  }

  if (errorMessage || !vehicle) {
    return (
      <AdminLayout>
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20">
          <p className="text-lg font-semibold text-slate-950">{errorMessage ?? 'Vehicle not found'}</p>
          <Button asChild className="mt-6 h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white hover:bg-[#2563EB]">
            <Link to="/documents">Back to Documents</Link>
          </Button>
        </div>
      </AdminLayout>
    )
  }


  return (
    <AdminLayout>
      <section className="rounded-[28px] bg-white/75 p-5 shadow-[0_24px_70px_rgba(59,130,246,0.10)] ring-1 ring-white/70 backdrop-blur-xl dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20 sm:p-6">
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:text-[#1d4ed8]"
        >
          <ArrowLeft className="size-4" />
          Back to Documents Centre
        </Link>

        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-[18px] bg-[#EAF4FF] text-[#2563EB] ring-2 ring-blue-100">
              <Truck className="size-8" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">{vehicle.registration}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{getVehicleName(vehicle)}</p>
              <p className="text-sm text-slate-400">Fleet {vehicle.fleetNumber ?? '—'}</p>
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
            { label: 'Valid Documents', value: counts.valid, tone: 'text-emerald-700 dark:text-emerald-300' },
            { label: 'Expiring Soon', value: counts.expiring, tone: 'text-amber-700 dark:text-amber-300' },
            { label: 'Expired', value: counts.expired, tone: 'text-rose-700 dark:text-rose-300' },
            { label: 'Compliance Score', value: `${complianceScore}%`, tone: getScoreTone(complianceScore) },
          ].map((card) => (
            <div key={card.label} className="rounded-[20px] bg-white p-5 shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className={`mt-3 text-3xl font-semibold tracking-[-0.05em] ${card.tone}`}>{card.value}</p>
            </div>
          ))}
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
            <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20">
              <p className="text-lg font-semibold text-slate-950">No compliance records yet</p>
              <p className="mt-2 text-sm text-slate-500">MOT, insurance and fleet documents appear here.</p>
            </div>
          ) : (
            <ComplianceDocumentsTable
              documents={documents}
              onEdit={handleEditDocument}
              onDelete={(doc) => void handleDeleteDocument(doc)}
              onUploadPlaceholder={() => showToast('Document upload will be available in a future release')}
            />
          )}
        </>
      ) : null}

      {activeTab === 'documents' ? (
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20">
          <FileText className="mx-auto size-10 text-slate-300" />
          <p className="mt-4 text-lg font-semibold text-slate-950">Document files</p>
          <p className="mt-2 text-sm text-slate-500">
            File uploads and document storage will be available in a future release.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/vehicles/${vehicle.id}`)}
            className="mt-4 text-[#2563EB]"
          >
            View vehicle profile
          </Button>
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70 dark:bg-slate-900/70 dark:ring-white/10 dark:shadow-black/20">
          <p className="text-lg font-semibold text-slate-950">Compliance history</p>
          <p className="mt-2 text-sm text-slate-500">
            Audit trail and change history will be available in a future release.
          </p>
        </div>
      ) : null}

      <AddVehicleComplianceRecordModal
        isOpen={isAddModalOpen}
        vehicles={allVehicles}
        defaultVehicleId={vehicle.id}
        isSaving={isSaving}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
      />

      <EditVehicleComplianceRecordModal
        record={editRecord}
        vehicles={allVehicles}
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
