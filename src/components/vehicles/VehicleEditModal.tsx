import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getDriverName,
  getScheduleReasonOptions,
  isVehicleFormDirty,
  scheduledAvailabilityStatuses,
  type VehicleFormErrors,
} from '@/lib/vehicleForm'
import type { Driver } from '@/services/driversService'
import { vehicleTypeOptions, type VehicleInput, type VehicleStatus } from '@/services/vehiclesService'

const vehicleStatuses: VehicleStatus[] = [
  'Available',
  'Assigned',
  'Workshop',
  'Maintenance',
  'Out of Service',
  'Off Road',
  'Reserved',
]

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

function UnsavedChangesDialog({
  onContinueEditing,
  onDiscard,
}: {
  onContinueEditing: () => void
  onDiscard: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[20px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
          Unsaved Changes
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
          You have unsaved changes.
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
          Do you want to discard them?
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] ease-out hover:bg-[#EAF4FF] hover:text-[#2563EB]"
          >
            Discard Changes
          </Button>
          <Button
            type="button"
            onClick={onContinueEditing}
            className="h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 hover:bg-[#2563EB]"
          >
            Continue Editing
          </Button>
        </div>
      </div>
    </div>
  )
}

type VehicleEditModalProps = {
  title: string
  eyebrow: string
  submitLabel: string
  form: VehicleInput
  drivers: Driver[]
  errors: VehicleFormErrors
  submitError: string | null
  isSubmitting: boolean
  onChange: (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function VehicleEditModal({
  title,
  eyebrow,
  submitLabel,
  form,
  drivers,
  errors,
  submitError,
  isSubmitting,
  onChange,
  onClose,
  onSubmit,
}: VehicleEditModalProps) {
  const initialFormRef = useRef(form)
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const isScheduledStatus = scheduledAvailabilityStatuses.includes(form.status)
  const reasonOptions = getScheduleReasonOptions(form.status)
  const isDirty = isVehicleFormDirty(form, initialFormRef.current)

  const requestClose = useCallback(() => {
    if (isSubmitting) return
    if (isDirty) {
      setIsDiscardDialogOpen(true)
      return
    }
    onClose()
  }, [isDirty, isSubmitting, onClose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || isSubmitting) return
      if (isDiscardDialogOpen) {
        event.preventDefault()
        setIsDiscardDialogOpen(false)
        return
      }
      event.preventDefault()
      requestClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDiscardDialogOpen, isSubmitting, requestClose])

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || isSubmitting) return
    requestClose()
  }

  function handleDiscardChanges() {
    setIsDiscardDialogOpen(false)
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div
          className="max-h-full w-full max-w-3xl overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
          onClick={(event) => event.stopPropagation()}
        >
          <form onSubmit={onSubmit} className="p-5 sm:p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6]">
              {eyebrow}
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {title}
            </h2>

            {submitError ? (
              <div className="mt-5 rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
                {submitError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ['registration', 'Registration Number'],
                ['fleetNumber', 'Fleet Number'],
                ['make', 'Make'],
                ['model', 'Model'],
                ['year', 'Year'],
                ['vin', 'VIN'],
                ['currentOdometer', 'Current Odometer'],
              ].map(([name, label]) => (
                <label key={name} className="block">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <Input
                    name={name}
                    value={form[name as keyof VehicleInput]}
                    onChange={onChange}
                    className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                  />
                  <FieldError message={errors[name as keyof VehicleInput]} />
                </label>
              ))}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Vehicle Type</span>
                <select
                  name="vehicleType"
                  value={form.vehicleType}
                  onChange={onChange}
                  required
                  className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                >
                  <option value="">Select vehicle type</option>
                  {vehicleTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.vehicleType} />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Current Driver</span>
                <select
                  name="currentDriverId"
                  value={form.currentDriverId}
                  onChange={onChange}
                  disabled={form.status === 'Off Road' && !form.offRoadStartDate}
                  className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                >
                  <option value="">
                    {form.status === 'Off Road' && !form.offRoadStartDate
                      ? 'Unavailable while Off Road'
                      : 'No current driver'}
                  </option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {getDriverName(driver)}
                    </option>
                  ))}
                </select>
                {form.status === 'Off Road' && !form.offRoadStartDate ? (
                  <p className="mt-1.5 text-xs font-medium text-slate-400">
                    Off Road vehicles cannot be assigned to drivers.
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Status</span>
                <select
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  className="mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                >
                  {vehicleStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              {isScheduledStatus ? (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Reason</span>
                    {reasonOptions.length > 0 ? (
                      <select
                        name="offRoadReason"
                        value={form.offRoadReason}
                        onChange={onChange}
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
                        name="offRoadReason"
                        value={form.offRoadReason}
                        onChange={onChange}
                        className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                      />
                    )}
                    <FieldError message={errors.offRoadReason} />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Start Date</span>
                    <Input
                      name="offRoadStartDate"
                      type="date"
                      value={form.offRoadStartDate}
                      onChange={onChange}
                      className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                    />
                    <FieldError message={errors.offRoadStartDate} />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">End Date</span>
                    <Input
                      name="offRoadExpectedReturnDate"
                      type="date"
                      value={form.offRoadExpectedReturnDate}
                      onChange={onChange}
                      className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                    />
                    <FieldError message={errors.offRoadExpectedReturnDate} />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Availability Notes
                    </span>
                    <textarea
                      name="offRoadNotes"
                      value={form.offRoadNotes}
                      onChange={onChange}
                      rows={3}
                      className="mt-2 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                    />
                    <FieldError message={errors.offRoadNotes} />
                  </label>
                </>
              ) : null}

              {[
                ['insuranceExpiry', 'Insurance Expiry'],
                ['motExpiry', 'MOT Expiry'],
                ['roadTaxExpiry', 'Road Tax Expiry'],
                ['tachographExpiry', 'Tachograph Calibration Expiry'],
              ].map(([name, label]) => (
                <label key={name} className="block">
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                  <Input
                    name={name}
                    type="date"
                    value={form[name as keyof VehicleInput]}
                    onChange={onChange}
                    className="mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200"
                  />
                </label>
              ))}

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Notes</span>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={onChange}
                  rows={4}
                  className="mt-2 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
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
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {isDiscardDialogOpen ? (
        <UnsavedChangesDialog
          onContinueEditing={() => setIsDiscardDialogOpen(false)}
          onDiscard={handleDiscardChanges}
        />
      ) : null}
    </>
  )
}
