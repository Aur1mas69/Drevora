import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VehicleTypeTemplateChecksModal } from '@/components/vehicles/VehicleTypeTemplateChecksModal'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { resolveCompanyTextScope } from '@/lib/companySettingsGlobals'
import {
  getDriverName,
  getScheduleReasonOptions,
  isVehicleFormDirty,
  scheduledAvailabilityStatuses,
  type VehicleFormErrors,
} from '@/lib/vehicleForm'
import type { Driver } from '@/services/driversService'
import {
  getVehicleTypeSelectOptions,
  type VehicleInput,
  type VehicleStatus,
} from '@/services/vehiclesService'

const vehicleStatuses: VehicleStatus[] = [
  'Available',
  'Assigned',
  'Workshop',
  'Maintenance',
  'Out of Service',
  'Off Road',
  'Reserved',
]

const vehicleFormInputClass =
  'mt-2 h-11 rounded-[16px] border-0 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-[#D3E9FC] focus-visible:ring-3 focus-visible:ring-[#BFE3F5]'

const vehicleFormSelectClass =
  'mt-2 h-11 w-full rounded-[16px] border-0 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-[#D3E9FC] outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-[#BFE3F5]'

const vehicleFormTextareaClass =
  'mt-2 w-full rounded-[16px] border-0 bg-white px-3 py-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-[#D3E9FC] outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-[#BFE3F5]'

const vehicleFormLabelClass = 'text-sm font-semibold text-[#113C69]'

function VehicleFormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[16px] border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF] to-[#F5FAFF]/95 p-4 ring-1 ring-[#C5DFFB]/35 sm:p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#0B68BE]">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

function DvlaSoonBadge() {
  return (
    <button
      type="button"
      disabled
      aria-label="DVLA lookup coming soon"
      title="DVLA lookup coming soon"
      className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full border border-[#D3E9FC] bg-gradient-to-r from-[#F5FAFF] to-[#EEF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#5499BF] ring-1 ring-[#C5DFFB]/50 select-none disabled:pointer-events-none disabled:opacity-90"
    >
      <Search className="size-3 shrink-0 opacity-75" aria-hidden />
      DVLA Soon
    </button>
  )
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
  const [isTemplateChecksOpen, setIsTemplateChecksOpen] = useState(false)
  const { settings, isLoading: isCompanyLoading } = useCompanySettings()
  const isScheduledStatus = scheduledAvailabilityStatuses.includes(form.status)
  const reasonOptions = getScheduleReasonOptions(form.status)
  const vehicleTypeSelectOptions = getVehicleTypeSelectOptions(form.vehicleType)
  const selectedVehicleType = form.vehicleType.trim()
  const isTrailer = selectedVehicleType === 'Trailer'
  const companyName = resolveCompanyTextScope(settings)
  const canManageTemplateChecks = Boolean(selectedVehicleType && companyName && !isCompanyLoading)
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
          className="flex max-h-[min(100%,calc(100vh-4rem))] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
          onClick={(event) => event.stopPropagation()}
        >
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
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
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-4 sm:px-6">
              <VehicleFormSection title="Basic Details">
                <label className="block sm:col-span-2">
                  <span className={vehicleFormLabelClass}>Vehicle type / category</span>
                  <select
                    name="vehicleType"
                    value={form.vehicleType}
                    onChange={onChange}
                    required
                    className={vehicleFormSelectClass}
                  >
                    <option value="">Select vehicle type</option>
                    {vehicleTypeSelectOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.vehicleType} />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canManageTemplateChecks}
                      onClick={() => setIsTemplateChecksOpen(true)}
                      className="h-9 rounded-[12px] border-[#C5DFFB] bg-white px-3 text-xs font-semibold text-[#0B68BE] hover:bg-[#F5FAFF] disabled:opacity-60"
                    >
                      + Template Checks
                    </Button>
                    {!selectedVehicleType ? (
                      <span className="text-xs font-medium text-[#5499BF]">
                        Select vehicle type first.
                      </span>
                    ) : isCompanyLoading ? (
                      <span className="text-xs font-medium text-[#5499BF]">
                        Company settings are still loading.
                      </span>
                    ) : !companyName ? (
                      <span className="text-xs font-medium text-[#5499BF]">
                        Company settings are still loading.
                      </span>
                    ) : null}
                  </div>
                </label>

                <label className="block">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <span className={vehicleFormLabelClass}>
                      {isTrailer ? 'Registration Number (optional)' : 'Registration Number'}
                    </span>
                    <DvlaSoonBadge />
                  </div>
                  <Input
                    name="registration"
                    value={form.registration}
                    onChange={onChange}
                    className={vehicleFormInputClass}
                  />
                  <p className="mt-1.5 text-xs font-medium text-[#5499BF]/85">
                    {isTrailer
                      ? 'Optional for trailers. Leave blank if the trailer has no registration plate.'
                      : 'DVLA lookup will be available in a future update.'}
                  </p>
                  <FieldError message={errors.registration} />
                </label>

                {isTrailer ? (
                  <label className="block">
                    <span className={vehicleFormLabelClass}>Trailer number</span>
                    <Input
                      name="trailerNumber"
                      value={form.trailerNumber}
                      onChange={onChange}
                      placeholder="PVG4546"
                      className={vehicleFormInputClass}
                    />
                    <p className="mt-1.5 text-xs font-medium text-[#5499BF]/85">
                      Internal fleet or trailer identification number.
                    </p>
                    <FieldError message={errors.trailerNumber} />
                  </label>
                ) : null}

                {[
                  ['fleetNumber', 'Fleet Number'],
                  ['make', 'Make'],
                  ['model', 'Model'],
                  ['year', 'Year'],
                  ['vin', 'VIN'],
                ].map(([name, label]) => (
                  <label key={name} className="block">
                    <span className={vehicleFormLabelClass}>{label}</span>
                    <Input
                      name={name}
                      value={form[name as keyof VehicleInput]}
                      onChange={onChange}
                      className={vehicleFormInputClass}
                    />
                    <FieldError message={errors[name as keyof VehicleInput]} />
                  </label>
                ))}
              </VehicleFormSection>

              <VehicleFormSection title="Assignment & Status">

                <label className="block">
                  <span className={vehicleFormLabelClass}>Current Driver</span>
                  <select
                    name="currentDriverId"
                    value={form.currentDriverId}
                    onChange={onChange}
                    disabled={form.status === 'Off Road' && !form.offRoadStartDate}
                    className={vehicleFormSelectClass}
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
                  <span className={vehicleFormLabelClass}>Status</span>
                  <select
                    name="status"
                    value={form.status}
                    onChange={onChange}
                    className={vehicleFormSelectClass}
                  >
                    {vehicleStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={vehicleFormLabelClass}>Current Odometer</span>
                  <Input
                    name="currentOdometer"
                    value={form.currentOdometer}
                    onChange={onChange}
                    className={vehicleFormInputClass}
                  />
                  <FieldError message={errors.currentOdometer} />
                </label>

                {isScheduledStatus ? (
                  <>
                    <label className="block">
                      <span className={vehicleFormLabelClass}>Reason</span>
                      {reasonOptions.length > 0 ? (
                        <select
                          name="offRoadReason"
                          value={form.offRoadReason}
                          onChange={onChange}
                          className={vehicleFormSelectClass}
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
                          className={vehicleFormInputClass}
                        />
                      )}
                      <FieldError message={errors.offRoadReason} />
                    </label>

                    <label className="block">
                      <span className={vehicleFormLabelClass}>Start Date</span>
                      <Input
                        name="offRoadStartDate"
                        type="date"
                        value={form.offRoadStartDate}
                        onChange={onChange}
                        className={vehicleFormInputClass}
                      />
                      <FieldError message={errors.offRoadStartDate} />
                    </label>

                    <label className="block">
                      <span className={vehicleFormLabelClass}>End Date</span>
                      <Input
                        name="offRoadExpectedReturnDate"
                        type="date"
                        value={form.offRoadExpectedReturnDate}
                        onChange={onChange}
                        className={vehicleFormInputClass}
                      />
                      <FieldError message={errors.offRoadExpectedReturnDate} />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className={vehicleFormLabelClass}>Availability Notes</span>
                      <textarea
                        name="offRoadNotes"
                        value={form.offRoadNotes}
                        onChange={onChange}
                        rows={3}
                        className={vehicleFormTextareaClass}
                      />
                      <FieldError message={errors.offRoadNotes} />
                    </label>
                  </>
                ) : null}
              </VehicleFormSection>

              <VehicleFormSection title="Compliance Dates">
                {[
                  ['motExpiry', 'MOT Expiry'],
                  ['insuranceExpiry', 'Insurance Expiry'],
                  ['roadTaxExpiry', 'Road Tax Expiry'],
                  ['tachographExpiry', 'Tachograph Calibration Expiry'],
                ].map(([name, label]) => (
                  <label key={name} className="block">
                    <span className={vehicleFormLabelClass}>{label}</span>
                    <Input
                      name={name}
                      type="date"
                      value={form[name as keyof VehicleInput]}
                      onChange={onChange}
                      className={vehicleFormInputClass}
                    />
                  </label>
                ))}
              </VehicleFormSection>

              <VehicleFormSection title="Notes">
                <label className="block sm:col-span-2">
                  <span className={vehicleFormLabelClass}>Notes</span>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={onChange}
                    rows={4}
                    className={vehicleFormTextareaClass}
                  />
                </label>
              </VehicleFormSection>
            </div>

            <div className="shrink-0 border-t border-[#D3E9FC]/80 bg-white px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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

      <VehicleTypeTemplateChecksModal
        isOpen={isTemplateChecksOpen}
        vehicleType={selectedVehicleType}
        onClose={() => setIsTemplateChecksOpen(false)}
      />
    </>
  )
}
