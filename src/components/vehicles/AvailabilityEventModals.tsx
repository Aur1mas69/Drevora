import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  calculateEventDuration,
  formatCalendarShortDate,
  formatShortDate,
} from '@/lib/vehicleAvailability'
import type { PlanningEvent } from '@/lib/vehiclePlanning'
import type {
  Vehicle,
  VehicleAvailability,
  VehicleAvailabilityInput,
  VehicleStatus,
} from '@/services/vehiclesService'
import { getVehicleStatusForDate } from '@/services/vehiclesService'

const vehicleStatuses: VehicleStatus[] = [
  'Available',
  'Assigned',
  'Workshop',
  'Maintenance',
  'Out of Service',
  'Off Road',
  'Reserved',
]

const offRoadReasons = [
  'Accident',
  'Mechanical Failure',
  'Awaiting Parts',
  'Insurance Expired',
  'MOT Expired',
  'SORN',
  'Other',
]

const maintenanceReasons = ['Service', 'Repair', 'MOT', 'Inspection', 'Tyres', 'Other']

function getReasonOptions(status: VehicleStatus): string[] {
  if (status === 'Off Road') return offRoadReasons
  if (status === 'Maintenance' || status === 'Workshop') return maintenanceReasons
  return []
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

type DetailRowProps = {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="rounded-2xl bg-[#F8FBFF] px-4 py-3.5 ring-1 ring-blue-50">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

export type AvailabilityDetailsContext = {
  vehicle: Vehicle
  record: VehicleAvailability | null
  planningEvent?: PlanningEvent | null
  date?: string
}

type AvailabilityDetailsModalProps = {
  context: AvailabilityDetailsContext
  onClose: () => void
  onEdit: (record: VehicleAvailability) => void
  onDelete: (record: VehicleAvailability) => void
}

export function AvailabilityDetailsModal({
  context,
  onClose,
  onEdit,
  onDelete,
}: AvailabilityDetailsModalProps) {
  const { vehicle, record, planningEvent } = context
  const currentStatus = getVehicleStatusForDate(vehicle)
  const event = planningEvent ?? null
  const scheduledStatus = record?.status ?? event?.label ?? null
  const canEdit = Boolean(record)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100">
        <div className="p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
            Availability Details
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {vehicle.registration}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {getVehicleName(vehicle)}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <DetailRow label="Vehicle" value={getVehicleName(vehicle)} />
            <DetailRow label="Registration" value={vehicle.registration} />
            <DetailRow label="Current Status" value={currentStatus} />
            <DetailRow
              label="Scheduled Status"
              value={scheduledStatus ?? 'No scheduled event'}
            />
            <DetailRow
              label="Reason"
              value={record?.reason ?? event?.reason ?? 'Not set'}
            />
            <DetailRow
              label="Start Date"
              value={
                record || event
                  ? formatShortDate(record?.startDate ?? event?.startDate ?? null)
                  : 'Not set'
              }
            />
            <DetailRow
              label="End Date"
              value={
                record || event
                  ? record?.endDate || event?.endDate
                    ? formatShortDate(record?.endDate ?? event?.endDate ?? null)
                    : 'Ongoing'
                  : 'Not set'
              }
            />
            <DetailRow
              label="Duration"
              value={
                record || event
                  ? calculateEventDuration(
                      record?.startDate ?? event?.startDate ?? '',
                      record?.endDate ?? event?.endDate ?? null,
                    )
                  : 'Not set'
              }
            />
            <DetailRow label="Notes" value={record?.notes ?? event?.notes ?? 'No notes'} />
            <DetailRow label="Created By" value="Not available yet" />
            <DetailRow
              label="Created Date"
              value={record ? formatShortDate(record.createdAt.slice(0, 10)) : 'Not set'}
            />
            <DetailRow
              label="Last Updated"
              value={record ? formatShortDate(record.createdAt.slice(0, 10)) : 'Not set'}
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
            >
              Close
            </Button>
            {record && canEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDelete(record)}
                  className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-rose-600 shadow-sm ring-1 ring-rose-100 transition-all duration-[250ms] ease-out hover:bg-rose-50"
                >
                  Delete Event
                </Button>
                <Button
                  type="button"
                  onClick={() => onEdit(record)}
                  className="h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
                >
                  Edit Event
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

type AvailabilityForm = Omit<VehicleAvailabilityInput, 'vehicleId'>
type AvailabilityFormErrors = Partial<Record<keyof AvailabilityForm, string>>

const initialAvailabilityForm: AvailabilityForm = {
  status: 'Off Road',
  startDate: '',
  endDate: '',
  reason: '',
  notes: '',
}

function getAvailabilityFormValues(record: VehicleAvailability): AvailabilityForm {
  return {
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate ?? '',
    reason: record.reason ?? '',
    notes: record.notes ?? '',
  }
}

type EditAvailabilityModalProps = {
  vehicle: Vehicle
  record: VehicleAvailability
  submitError: string | null
  isSubmitting: boolean
  onClose: () => void
  onSave: (input: VehicleAvailabilityInput) => Promise<void>
}

export function EditAvailabilityModal({
  vehicle,
  record,
  submitError,
  isSubmitting,
  onClose,
  onSave,
}: EditAvailabilityModalProps) {
  const [form, setForm] = useState<AvailabilityForm>(
    getAvailabilityFormValues(record),
  )
  const [errors, setErrors] = useState<AvailabilityFormErrors>({})
  const reasonOptions = getReasonOptions(form.status)

  function handleChange(
    event: ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'status' ? { reason: '' } : {}),
    }))
    setErrors((currentErrors) => ({ ...currentErrors, [name]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors: AvailabilityFormErrors = {}
    if (!form.startDate) validationErrors.startDate = 'Start date is required.'
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      validationErrors.endDate = 'End date must be after start date.'
    }

    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    await onSave({
      vehicleId: vehicle.id,
      ...form,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100">
        <form onSubmit={handleSubmit} className="p-5 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
            Edit Availability
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            Edit Event
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {vehicle.registration} • {formatCalendarShortDate(record.startDate)}
          </p>

          {submitError ? (
            <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Status</span>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
              >
                {vehicleStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Reason</span>
              {reasonOptions.length > 0 ? (
                <select
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                >
                  <option value="">Select reason</option>
                  {reasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                />
              )}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Start Date</span>
              <Input
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.startDate} />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">End Date</span>
              <Input
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
                className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
              />
              <FieldError message={errors.endDate} />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700">Notes</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                className="mt-2 w-full resize-none rounded-[16px] border-0 bg-[#F8FBFF] px-3 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB] disabled:translate-y-0 disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

type DeleteAvailabilityModalProps = {
  record: VehicleAvailability
  vehicleRegistration: string
  errorMessage: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteAvailabilityModal({
  record,
  vehicleRegistration,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteAvailabilityModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-rose-500">
          Delete Availability Event
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
          Are you sure you want to delete this scheduled event?
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
          {vehicleRegistration} • {record.status} •{' '}
          {formatShortDate(record.startDate)}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-500">
          This action cannot be undone.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-11 rounded-[16px] bg-rose-600 px-5 font-semibold text-white shadow-[0_14px_28px_rgba(225,29,72,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-rose-700 disabled:translate-y-0 disabled:opacity-70"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { initialAvailabilityForm, getAvailabilityFormValues }
