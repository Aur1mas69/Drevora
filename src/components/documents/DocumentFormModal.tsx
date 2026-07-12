import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type { Document, DocumentAppliesTo, DocumentFormSubmitPayload } from '@/lib/documentTypes'
import { isMedicalDocumentType } from '@/lib/documentTypes'
import {
  buildEmptyDocumentFormValues,
  documentFormValuesToInput,
  documentToFormValues,
  getDocumentTypesForAppliesTo,
  validateDocumentForm,
} from '@/lib/documentUtils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DocumentFileField } from './DocumentFileField'
import { documentFieldClass, documentTextareaClass } from './documentUiStyles'

type DocumentFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  record: Document | null
  workers: Driver[]
  vehicles: Vehicle[]
  defaultAppliesTo?: DocumentAppliesTo
  defaultWorkerId?: string
  defaultVehicleId?: string
  allowMedicalDocumentUploads?: boolean
  isSaving?: boolean
  onClose: () => void
  onSubmit: (payload: DocumentFormSubmitPayload) => Promise<void>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>
}

export function DocumentFormModal({
  isOpen,
  mode,
  record,
  workers,
  vehicles,
  defaultAppliesTo = 'company',
  defaultWorkerId,
  defaultVehicleId,
  allowMedicalDocumentUploads = false,
  isSaving = false,
  onClose,
  onSubmit,
}: DocumentFormModalProps) {
  useBodyScrollLock(isOpen)
  const [values, setValues] = useState(buildEmptyDocumentFormValues(defaultAppliesTo))
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isMedicalType = isMedicalDocumentType(values.documentType)
  const canChangeMedicalFile = !isMedicalType || allowMedicalDocumentUploads

  const typeOptions = useMemo(() => {
    return getDocumentTypesForAppliesTo(values.appliesTo, {
      allowMedicalDocumentUploads:
        allowMedicalDocumentUploads ||
        (mode === 'edit' && isMedicalDocumentType(record?.documentType)),
    })
  }, [allowMedicalDocumentUploads, mode, record?.documentType, values.appliesTo])

  useEffect(() => {
    if (!isOpen) return
    if (record) {
      setValues(documentToFormValues(record))
    } else {
      const base = buildEmptyDocumentFormValues(defaultAppliesTo)
      const types = getDocumentTypesForAppliesTo(defaultAppliesTo, {
        allowMedicalDocumentUploads,
      })
      setValues({
        ...base,
        documentType: types.includes(base.documentType as never)
          ? base.documentType
          : (types[0] ?? 'Other'),
        workerId: defaultWorkerId ?? '',
        vehicleId: defaultVehicleId ?? '',
      })
    }
    setSelectedFile(null)
    setRemoveFile(false)
    setErrors({})
    setSubmitError(null)
  }, [
    allowMedicalDocumentUploads,
    defaultAppliesTo,
    defaultVehicleId,
    defaultWorkerId,
    record,
    isOpen,
  ])

  function updateAppliesTo(appliesTo: DocumentAppliesTo) {
    const types = getDocumentTypesForAppliesTo(appliesTo, {
      allowMedicalDocumentUploads:
        allowMedicalDocumentUploads ||
        (mode === 'edit' && isMedicalDocumentType(record?.documentType)),
    })
    setValues((current) => ({
      ...current,
      appliesTo,
      documentType: types.includes(current.documentType as never)
        ? current.documentType
        : (types[0] ?? 'Other'),
      workerId: appliesTo === 'worker' ? current.workerId : '',
      vehicleId: appliesTo === 'vehicle' ? current.vehicleId : '',
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validateDocumentForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (isMedicalDocumentType(values.documentType) && !allowMedicalDocumentUploads) {
      if (mode === 'create' || selectedFile || removeFile) {
        setSubmitError(
          'Medical document uploads are disabled. Enable “Allow medical document uploads” in Settings → Documents.',
        )
        return
      }
    }

    setSubmitError(null)
    try {
      await onSubmit({
        values,
        file: selectedFile,
        removeFile,
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save document.')
    }
  }

  if (!isOpen || typeof window === 'undefined') return null

  const sortedWorkers = [...workers].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  )
  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        className="max-h-[min(92vh,900px)] w-full max-w-2xl overflow-hidden rounded-[20px] border border-[#D3E9FC] bg-white shadow-[0_24px_60px_rgba(33,142,231,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-form-title"
      >
        <div className="flex items-start justify-between border-b border-[#D3E9FC] px-5 py-4">
          <div>
            <h2 id="document-form-title" className="text-lg font-semibold text-[#113C69]">
              {mode === 'create' ? 'Add Document' : 'Edit Document'}
            </h2>
            <p className="mt-0.5 text-sm text-[#5499BF]">
              Track expiry dates and attach PDF or image files.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-[#5499BF] hover:bg-[#F5FAFF] hover:text-[#113C69]"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="overflow-y-auto px-5 py-4">
          {submitError ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 block">
              <span className="text-sm font-semibold text-[#113C69]">Applies to</span>
              <select
                value={values.appliesTo}
                onChange={(event) => updateAppliesTo(event.target.value as DocumentAppliesTo)}
                className={documentFieldClass}
                disabled={mode === 'edit'}
              >
                <option value="company">Company</option>
                <option value="worker">Worker</option>
                <option value="vehicle">Vehicle</option>
              </select>
            </label>

            {values.appliesTo === 'worker' ? (
              <label className="sm:col-span-2 block">
                <span className="text-sm font-semibold text-[#113C69]">Worker</span>
                <select
                  value={values.workerId}
                  onChange={(event) => setValues((c) => ({ ...c, workerId: event.target.value }))}
                  className={documentFieldClass}
                >
                  <option value="">Select worker</option>
                  {sortedWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.firstName} {worker.lastName}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.workerId} />
              </label>
            ) : null}

            {values.appliesTo === 'vehicle' ? (
              <label className="sm:col-span-2 block">
                <span className="text-sm font-semibold text-[#113C69]">Vehicle</span>
                <select
                  value={values.vehicleId}
                  onChange={(event) => setValues((c) => ({ ...c, vehicleId: event.target.value }))}
                  className={documentFieldClass}
                >
                  <option value="">Select vehicle</option>
                  {sortedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.vehicleId} />
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-[#113C69]">Document name</span>
              <input
                value={values.documentName}
                onChange={(event) =>
                  setValues((c) => ({ ...c, documentName: event.target.value }))
                }
                className={documentFieldClass}
                placeholder="e.g. Operator Licence 2026"
              />
              <FieldError message={errors.documentName} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#113C69]">Document type</span>
              <select
                value={values.documentType}
                onChange={(event) =>
                  setValues((c) => ({ ...c, documentType: event.target.value }))
                }
                className={documentFieldClass}
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <FieldError message={errors.documentType} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#113C69]">Reference number</span>
              <input
                value={values.referenceNumber}
                onChange={(event) =>
                  setValues((c) => ({ ...c, referenceNumber: event.target.value }))
                }
                className={documentFieldClass}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#113C69]">Issue date</span>
              <input
                type="date"
                value={values.issueDate}
                onChange={(event) => setValues((c) => ({ ...c, issueDate: event.target.value }))}
                className={documentFieldClass}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-[#113C69]">Expiry date</span>
              <input
                type="date"
                value={values.expiryDate}
                onChange={(event) => setValues((c) => ({ ...c, expiryDate: event.target.value }))}
                className={documentFieldClass}
              />
            </label>

            <div className="sm:col-span-2">
              <span className="text-sm font-semibold text-[#113C69]">Attachment</span>
              <div className="mt-1.5">
                {isMedicalType && !canChangeMedicalFile ? (
                  <div className="rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] px-4 py-3 text-sm text-[#5499BF]">
                    {record?.filePath || record?.fileUrl ? (
                      <p>
                        A medical file is already stored. New uploads are disabled until medical
                        document uploads are enabled in Settings → Documents.
                      </p>
                    ) : (
                      <p>
                        Medical document uploads are disabled. You can still keep an optional expiry
                        date. Enable uploads in Settings → Documents when your company has a lawful
                        reason to retain copies.
                      </p>
                    )}
                  </div>
                ) : (
                  <DocumentFileField
                    existingPath={record?.filePath ?? record?.fileUrl ?? null}
                    selectedFile={selectedFile}
                    removeFile={removeFile}
                    onSelectFile={setSelectedFile}
                    onRemoveExisting={() => {
                      setRemoveFile(true)
                      setSelectedFile(null)
                    }}
                    onClearSelection={() => setSelectedFile(null)}
                  />
                )}
              </div>
            </div>

            <label className="sm:col-span-2 block">
              <span className="text-sm font-semibold text-[#113C69]">Notes</span>
              <textarea
                value={values.notes}
                onChange={(event) => setValues((c) => ({ ...c, notes: event.target.value }))}
                className={documentTextareaClass}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[#D3E9FC] pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white"
            >
              {isSaving ? 'Saving…' : mode === 'create' ? 'Add Document' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

export { documentFormValuesToInput }
