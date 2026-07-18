import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ComplianceRecordFormInput } from '@/lib/complianceTypes'
import { WORKER_COMPLIANCE_DOCUMENT_TYPES } from '@/lib/complianceTypes'
import { getSuggestedDocumentTypes } from '@/lib/complianceUtils'
import type { Driver } from '@/services/driversService'
import { Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type AddComplianceRecordModalProps = {
  isOpen: boolean
  workers: Driver[]
  defaultWorkerId?: string
  isSaving?: boolean
  onClose: () => void
  onSubmit: (input: ComplianceRecordFormInput) => Promise<void>
}

const selectClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

export function AddComplianceRecordModal({
  isOpen,
  workers,
  defaultWorkerId,
  isSaving = false,
  onClose,
  onSubmit,
}: AddComplianceRecordModalProps) {
  const [workerId, setWorkerId] = useState('')
  const [documentType, setDocumentType] = useState<string>(WORKER_COMPLIANCE_DOCUMENT_TYPES[0])
  const [documentName, setDocumentName] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sortedWorkers = useMemo(
    () =>
      [...workers].sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      ),
    [workers],
  )

  const selectedWorker = sortedWorkers.find((worker) => worker.id === workerId)
  const suggestions = getSuggestedDocumentTypes(selectedWorker?.role)

  useEffect(() => {
    if (!isOpen) return
    setWorkerId(defaultWorkerId ?? sortedWorkers[0]?.id ?? '')
    setDocumentType(WORKER_COMPLIANCE_DOCUMENT_TYPES[0])
    setDocumentName('')
    setIssueDate('')
    setExpiryDate('')
    setReferenceNumber('')
    setNotes('')
    setError(null)
  }, [defaultWorkerId, isOpen, sortedWorkers])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!workerId) {
      setError('Please select a worker.')
      return
    }
    try {
      await onSubmit({
        workerId,
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
        submitError instanceof Error ? submitError.message : 'Failed to save compliance record.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-[18px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 dark:shadow-black/50 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-compliance-record-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-compliance-record-title" className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
              Add Compliance Record
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Track licences, training and certifications for any worker role.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving} className="h-8 w-8 rounded-[10px] p-0" aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Worker
            <select value={workerId} onChange={(event) => setWorkerId(event.target.value)} className={selectClassName} required disabled={Boolean(defaultWorkerId)}>
              {sortedWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.firstName} {worker.lastName} · {worker.role}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Document Type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className={selectClassName} required>
              {WORKER_COMPLIANCE_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          {suggestions.length > 0 ? (
            <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-xs text-slate-600">
              Common for {selectedWorker?.role ?? 'this role'}:{' '}
              <span className="font-medium text-[#2A376F]">{suggestions.join(', ')}</span>
            </p>
          ) : null}

          <label className="block text-sm font-medium text-slate-700">
            Document Name
            <Input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="Optional display name" className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]" />
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
            <Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Licence or certificate reference" className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF]" />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="mt-1.5 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100" />
          </label>

          <div className="rounded-[12px] border border-dashed border-[rgba(75,120,220,0.20)] bg-[#F8FBFF] px-4 py-4">
            <div className="flex items-start gap-3">
              <Upload className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-slate-700">Upload File</p>
                <p className="mt-1 text-xs text-slate-500">Document upload will be available in a future release.</p>
              </div>
            </div>
          </div>

          {error ? <p className="rounded-[10px] bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600">Cancel</Button>
            <Button type="submit" disabled={isSaving || sortedWorkers.length === 0} className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]">
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
