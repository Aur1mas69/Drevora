import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import type {
  DriverReport,
  DriverReportFormSubmitPayload,
} from '@/lib/driverReportTypes'
import {
  DRIVER_REPORT_PRIORITIES,
  DRIVER_REPORT_STATUSES,
  DRIVER_REPORT_TYPES,
} from '@/lib/driverReportTypes'
import {
  buildEmptyDriverReportFormValues,
  driverReportToFormValues,
  validateDriverReportForm,
} from '@/lib/driverReportUtils'
import type { Driver } from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'
import { X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DriverReportFileField } from './DriverReportFileField'
import { driverReportFieldClass, driverReportTextareaClass } from './driverReportUiStyles'

export type DriverReportFormContext = 'admin' | 'worker'

type DriverReportFormModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  formContext: DriverReportFormContext
  record: DriverReport | null
  workers: Driver[]
  vehicles: Vehicle[]
  currentWorkerId?: string | null
  currentWorkerName?: string | null
  isSaving?: boolean
  onClose: () => void
  onSubmit: (payload: DriverReportFormSubmitPayload) => Promise<void>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs font-medium text-rose-600">{message}</p>
}

export function DriverReportFormModal({
  isOpen,
  mode,
  formContext,
  record,
  workers,
  vehicles,
  currentWorkerId,
  currentWorkerName,
  isSaving = false,
  onClose,
  onSubmit,
}: DriverReportFormModalProps) {
  useBodyScrollLock(isOpen)
  const [values, setValues] = useState(buildEmptyDriverReportFormValues())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isAdminForm = formContext === 'admin'
  const showWorkerField = isAdminForm
  const showOfficeNotes = isAdminForm
  const showStatusField = isAdminForm

  const updateField = useCallback(
    <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
      setValues((current) => ({ ...current, [key]: value }))
      setErrors((current) => {
        if (!current[key as string]) return current
        const next = { ...current }
        delete next[key as string]
        return next
      })
    },
    [],
  )

  useEffect(() => {
    if (!isOpen) return

    if (record) {
      setValues(driverReportToFormValues(record))
    } else {
      const base = buildEmptyDriverReportFormValues()
      setValues({
        ...base,
        workerId: isAdminForm ? '' : currentWorkerId ?? '',
        status: 'New',
        priority: 'Medium',
      })
    }

    setSelectedFile(null)
    setRemoveFile(false)
    setErrors({})
    setSubmitError(null)
  }, [currentWorkerId, isAdminForm, record, isOpen])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const submissionValues = isAdminForm
      ? values
      : { ...values, workerId: currentWorkerId ?? values.workerId }

    const nextErrors = validateDriverReportForm(submissionValues, {
      requireWorkerSelection: isAdminForm,
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitError(null)
    try {
      await onSubmit({
        values: submissionValues,
        file: selectedFile,
        removeFile,
      })
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save report.')
    }
  }

  if (!isOpen || typeof window === 'undefined') return null

  const sortedWorkers = [...workers].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
  )
  const sortedVehicles = [...vehicles].sort((a, b) =>
    a.registration.localeCompare(b.registration),
  )
  const existingPath =
    record?.attachmentPath?.trim() || record?.attachmentUrl?.trim() || null

  const workerFieldUnavailable = showWorkerField && sortedWorkers.length === 0

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-[20px] border border-[#D3E9FC] bg-white shadow-[0_24px_60px_rgba(33,142,231,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-report-form-title"
      >
        <div className="shrink-0 border-b border-[#D3E9FC] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="driver-report-form-title" className="text-lg font-semibold text-[#113C69]">
                {mode === 'create' ? 'New Report' : 'Edit Report'}
              </h2>
              <p className="mt-0.5 text-sm text-[#5499BF]">
                {isAdminForm
                  ? 'Log operational issues for office review.'
                  : 'Report an issue directly to the office.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="shrink-0 rounded-lg p-2 text-[#5499BF] hover:bg-[#F5FAFF] hover:text-[#113C69]"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-4">
            <label className="block text-sm font-semibold text-[#113C69]">
              Report title
              <input
                value={values.title}
                onChange={(event) => updateField('title', event.target.value)}
                className={driverReportFieldClass}
                placeholder="Short summary of the issue"
              />
              <FieldError message={errors.title} />
            </label>

            <div className={`grid gap-4 ${showWorkerField ? 'sm:grid-cols-2' : ''}`}>
              <label className="block text-sm font-semibold text-[#113C69]">
                Report type
                <select
                  value={values.reportType}
                  onChange={(event) => updateField('reportType', event.target.value)}
                  className={driverReportFieldClass}
                >
                  {DRIVER_REPORT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.reportType} />
              </label>

              {showWorkerField ? (
                <label className="block text-sm font-semibold text-[#113C69]">
                  Worker
                  <select
                    value={values.workerId}
                    onChange={(event) => updateField('workerId', event.target.value)}
                    className={driverReportFieldClass}
                    disabled={workerFieldUnavailable}
                  >
                    <option value="">
                      {workerFieldUnavailable ? 'No workers available' : 'Select worker'}
                    </option>
                    {sortedWorkers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.firstName} {worker.lastName}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.workerId} />
                  {workerFieldUnavailable ? (
                    <p className="mt-1 text-xs text-[#5499BF]">
                      Add workers before creating reports.
                    </p>
                  ) : null}
                </label>
              ) : null}
            </div>

            {!isAdminForm && currentWorkerName ? (
              <p className="rounded-[12px] border border-[#C5DFFB] bg-[#F5FAFF] px-3 py-2 text-sm text-[#113C69]">
                Reporting as <span className="font-semibold">{currentWorkerName}</span>
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#113C69]">
                Vehicle <span className="font-normal text-[#5499BF]">(optional)</span>
                <select
                  value={values.vehicleId}
                  onChange={(event) => updateField('vehicleId', event.target.value)}
                  className={driverReportFieldClass}
                >
                  <option value="">No vehicle</option>
                  {sortedVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration}
                      {vehicle.fleetNumber ? ` · ${vehicle.fleetNumber}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-[#113C69]">
                Priority
                <select
                  value={values.priority}
                  onChange={(event) =>
                    updateField('priority', event.target.value as typeof values.priority)
                  }
                  className={driverReportFieldClass}
                >
                  {DRIVER_REPORT_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {showStatusField ? (
              <label className="block text-sm font-semibold text-[#113C69]">
                Status
                <select
                  value={values.status}
                  onChange={(event) =>
                    updateField('status', event.target.value as typeof values.status)
                  }
                  className={driverReportFieldClass}
                >
                  {DRIVER_REPORT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-sm font-semibold text-[#113C69]">
              Date/time of issue
              <input
                type="datetime-local"
                value={values.issueDatetime}
                onChange={(event) => updateField('issueDatetime', event.target.value)}
                className={driverReportFieldClass}
              />
            </label>

            <label className="block text-sm font-semibold text-[#113C69]">
              Location / site <span className="font-normal text-[#5499BF]">(optional)</span>
              <input
                value={values.location}
                onChange={(event) => updateField('location', event.target.value)}
                className={driverReportFieldClass}
                placeholder="Site or address"
              />
            </label>

            <label className="block text-sm font-semibold text-[#113C69]">
              Description
              <textarea
                value={values.description}
                onChange={(event) => updateField('description', event.target.value)}
                className={driverReportTextareaClass}
                placeholder="What happened?"
                rows={4}
              />
              <FieldError message={errors.description} />
            </label>

            <div>
              <p className="text-sm font-semibold text-[#113C69]">
                Attachments / photos <span className="font-normal text-[#5499BF]">(optional)</span>
              </p>
              <div className="mt-1.5">
                <DriverReportFileField
                  existingPath={existingPath}
                  selectedFile={selectedFile}
                  removeFile={removeFile}
                  onSelectFile={setSelectedFile}
                  onRemoveExisting={() => setRemoveFile(true)}
                  onClearSelection={() => setSelectedFile(null)}
                />
              </div>
            </div>

            {showOfficeNotes ? (
              <label className="block text-sm font-semibold text-[#113C69]">
                Office notes <span className="font-normal text-[#5499BF]">(optional)</span>
                <textarea
                  value={values.officeNotes}
                  onChange={(event) => updateField('officeNotes', event.target.value)}
                  className={driverReportTextareaClass}
                  placeholder="Internal notes for managers"
                  rows={3}
                />
              </label>
            ) : null}

            {submitError ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#D3E9FC] bg-white px-5 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || (!isAdminForm && !currentWorkerId)}
              className="bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white"
            >
              {isSaving ? 'Saving…' : mode === 'create' ? 'Create report' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

export { driverReportFormValuesToInput } from '@/lib/driverReportUtils'
