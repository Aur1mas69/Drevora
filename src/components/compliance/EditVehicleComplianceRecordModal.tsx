import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { VehicleComplianceRecord, VehicleComplianceRecordFormInput } from '@/lib/complianceTypes'
import { VEHICLE_COMPLIANCE_DOCUMENT_TYPES } from '@/lib/complianceTypes'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type EditVehicleComplianceRecordModalProps = {
  record: VehicleComplianceRecord | null
  vehicles: Vehicle[]
  isOpen: boolean
  isSaving?: boolean
  onClose: () => void
  onSubmit: (input: VehicleComplianceRecordFormInput) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

export function EditVehicleComplianceRecordModal({
  record,
  vehicles,
  isOpen,
  isSaving = false,
  onClose,
  onSubmit,
}: EditVehicleComplianceRecordModalProps) {
  const [vehicleId, setVehicleId] = useState('')
  const [documentType, setDocumentType] = useState<string>(VEHICLE_COMPLIANCE_DOCUMENT_TYPES[0])
  const [documentName, setDocumentName] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  )

  useEffect(() => {
    if (!isOpen || !record) return
    setVehicleId(record.vehicleId)
    setDocumentType(record.documentType)
    setDocumentName(record.documentName ?? '')
    setIssueDate(record.issueDate ?? '')
    setExpiryDate(record.expiryDate ?? '')
    setReferenceNumber(record.referenceNumber ?? '')
    setNotes(record.notes ?? '')
    setError(null)
  }, [isOpen, record])

  if (!isOpen || !record) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await onSubmit({
        vehicleId,
        documentType,
        documentName,
        issueDate,
        expiryDate,
        referenceNumber,
        notes,
      })
      onClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to update compliance record.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[18px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 dark:shadow-black/50 sm:p-6" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">Edit Vehicle Compliance Record</h2>
            <p className="mt-1 text-sm text-slate-500">{record.vehicleRegistration}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="h-8 w-8 rounded-[10px] p-0" aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Vehicle
            <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={selectClassName} required>
              {sortedVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Document Type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className={selectClassName} required>
              {VEHICLE_COMPLIANCE_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Document Name
            <Input value={documentName} onChange={(event) => setDocumentName(event.target.value)} className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Issue Date
              <Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Expiry Date
              <Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]" />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Reference Number
            <Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]" />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1.5 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
          </label>

          {error ? <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600">Cancel</Button>
            <Button type="submit" disabled={isSaving} className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
              {isSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
