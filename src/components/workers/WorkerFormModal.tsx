import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorkerAvatarField } from '@/components/workers/WorkerAvatarField'
import { WorkerCodeBadge } from '@/components/workers/WorkerCodeBadge'
import {
  WORKER_EMPLOYMENT_TYPES,
  WORKER_LICENCE_CATEGORY_OPTIONS,
} from '@/lib/workerProfileUtils'
import { WorkerLicenceCategoryBadges } from '@/components/workers/WorkerLicenceCategoryBadges'
import type {
  CreateDriverInput,
  DriverRole,
  DriverStatus,
  LicenceCategory,
} from '@/services/driversService'
import type { Vehicle } from '@/services/vehiclesService'

type DriverFormErrors = Partial<Record<keyof CreateDriverInput, string>>

const fieldInputClass =
  'mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10'

const fieldSelectClass =
  'mt-2 h-11 w-full rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 outline-none transition-all duration-[250ms] ease-out focus:ring-3 focus:ring-blue-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs font-medium text-rose-500">{message}</p>
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[18px] bg-[#F8FBFF]/80 p-4 ring-1 ring-[#D3E9FC]/80 dark:bg-slate-900/40 dark:ring-white/10">
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#113C69] dark:text-slate-100">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs font-medium text-[#5499BF]/90 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

type WorkerFormModalProps = {
  eyebrow: string
  title: string
  submitLabel: string
  form: CreateDriverInput
  errors: DriverFormErrors
  submitError: string | null
  isSubmitting: boolean
  workerCode?: string | null
  avatarUrl?: string | null
  pendingAvatarFile?: File | null
  removeAvatar?: boolean
  isAvatarUploading?: boolean
  avatarError?: string | null
  onAvatarFileSelect?: (file: File | null) => void
  onRemoveAvatar?: () => void
  onClearPendingAvatar?: () => void
  vehicles: Vehicle[]
  workerRoles: DriverRole[]
  driverStatuses: DriverStatus[]
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  onLicenceCategoriesChange: (categories: LicenceCategory[]) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function WorkerFormModal({
  eyebrow,
  title,
  submitLabel,
  form,
  errors,
  submitError,
  isSubmitting,
  workerCode,
  avatarUrl,
  pendingAvatarFile = null,
  removeAvatar = false,
  isAvatarUploading = false,
  avatarError,
  onAvatarFileSelect,
  onRemoveAvatar,
  onClearPendingAvatar,
  vehicles,
  workerRoles,
  driverStatuses,
  onChange,
  onLicenceCategoriesChange,
  onClose,
  onSubmit,
}: WorkerFormModalProps) {
  function toggleLicenceCategory(category: LicenceCategory) {
    const next = form.licenceCategories.includes(category)
      ? form.licenceCategories.filter((item) => item !== category)
      : [...form.licenceCategories, category]
    onLicenceCategoriesChange(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-950 dark:ring-white/10">
        <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6] dark:text-blue-400">
                {eyebrow}
              </p>
              <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
                {title}
              </h2>
            </div>
            {workerCode ? (
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Worker ID
                </p>
                <div className="mt-2">
                  <WorkerCodeBadge code={workerCode} />
                </div>
              </div>
            ) : null}
          </div>

          {submitError ? (
            <div className="rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {submitError}
            </div>
          ) : null}

          {onAvatarFileSelect && onRemoveAvatar && onClearPendingAvatar ? (
            <WorkerAvatarField
              firstName={form.firstName}
              lastName={form.lastName}
              avatarUrl={avatarUrl}
              pendingFile={pendingAvatarFile}
              removeAvatar={removeAvatar}
              isUploading={isAvatarUploading || isSubmitting}
              errorMessage={avatarError}
              onFileSelect={onAvatarFileSelect}
              onRemoveAvatar={onRemoveAvatar}
              onClearPending={onClearPendingAvatar}
            />
          ) : null}

          <FormSection title="Basic Details" description="Core contact information for this worker.">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                First Name <span className="text-rose-500">*</span>
              </span>
              <Input name="firstName" value={form.firstName} onChange={onChange} className={fieldInputClass} />
              <FieldError message={errors.firstName} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Last Name <span className="text-rose-500">*</span>
              </span>
              <Input name="lastName" value={form.lastName} onChange={onChange} className={fieldInputClass} />
              <FieldError message={errors.lastName} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email</span>
              <Input name="email" type="email" value={form.email} onChange={onChange} className={fieldInputClass} />
              <FieldError message={errors.email} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Phone</span>
              <Input name="phone" value={form.phone} onChange={onChange} className={fieldInputClass} />
              <FieldError message={errors.phone} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Company</span>
              <Input name="company" value={form.company} onChange={onChange} className={fieldInputClass} />
              <FieldError message={errors.company} />
            </label>
          </FormSection>

          <FormSection title="Address" description="Optional home or contact address for this worker.">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Address Line 1</span>
              <Input name="addressLine1" value={form.addressLine1} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Address Line 2</span>
              <Input name="addressLine2" value={form.addressLine2} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Town / City</span>
              <Input name="townCity" value={form.townCity} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">County</span>
              <Input name="county" value={form.county} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Postcode</span>
              <Input name="postcode" value={form.postcode} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Country</span>
              <Input name="country" value={form.country} onChange={onChange} className={fieldInputClass} />
            </label>
          </FormSection>

          <FormSection title="Work Details" description="Role, status, default vehicle and start date.">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Role <span className="text-rose-500">*</span>
              </span>
              <select name="role" value={form.role} onChange={onChange} className={fieldSelectClass}>
                {workerRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <FieldError message={errors.role} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Employment Type
              </span>
              <select
                name="employmentType"
                value={form.employmentType}
                onChange={onChange}
                className={fieldSelectClass}
              >
                <option value="">Not set</option>
                {WORKER_EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Status</span>
              <select name="status" value={form.status} onChange={onChange} className={fieldSelectClass}>
                {driverStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Default Vehicle</span>
              <select
                name="defaultVehicleId"
                value={form.defaultVehicleId}
                onChange={onChange}
                className={fieldSelectClass}
              >
                <option value="">No default vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration}
                    {vehicle.fleetNumber ? ` · ${vehicle.fleetNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Start Date</span>
              <Input name="startDate" type="date" value={form.startDate} onChange={onChange} className={fieldInputClass} />
            </label>
          </FormSection>

          <FormSection
            title="Holiday Entitlement"
            description="Worker-level values override the Employment Type defaults from Settings."
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Paid holiday enabled
              </span>
              <select
                name="paidHolidayEnabled"
                value={form.paidHolidayEnabled === null ? '' : String(form.paidHolidayEnabled)}
                onChange={onChange}
                className={fieldSelectClass}
              >
                <option value="">Use Employment Type default</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Annual paid holiday days
              </span>
              <Input
                name="annualPaidHolidayDays"
                type="number"
                min={0}
                step="0.5"
                value={form.annualPaidHolidayDays}
                onChange={onChange}
                className={fieldInputClass}
                placeholder="Use default"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Bank holiday entitlement days
              </span>
              <Input
                name="bankHolidayEntitlementDays"
                type="number"
                min={0}
                step="0.5"
                value={form.bankHolidayEntitlementDays}
                onChange={onChange}
                className={fieldInputClass}
                placeholder="Use default"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Unpaid leave allowed
              </span>
              <select
                name="unpaidLeaveAllowed"
                value={String(form.unpaidLeaveAllowed)}
                onChange={onChange}
                className={fieldSelectClass}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Entitlement notes
              </span>
              <Input
                name="holidayEntitlementNotes"
                value={form.holidayEntitlementNotes}
                onChange={onChange}
                className={fieldInputClass}
                placeholder="Optional notes for this worker"
              />
            </label>
          </FormSection>

          <FormSection
            title="Licence & Compliance"
            description="UK HGV licence, CPC, tachograph card and D4 medical dates."
          >
            <div className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Licence Categories
              </span>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Select all UK licence and equipment categories that apply.
              </p>
              {form.licenceCategories.length > 0 ? (
                <div className="mt-3 rounded-[16px] bg-[#F5FAFF] px-3 py-2.5 ring-1 ring-[#C5DFFB]/60 dark:bg-slate-900/50 dark:ring-white/10">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5499BF]/85">
                    Selected
                  </p>
                  <WorkerLicenceCategoryBadges
                    categories={form.licenceCategories}
                    className="mt-2"
                  />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {WORKER_LICENCE_CATEGORY_OPTIONS.map((option) => {
                  const selected = form.licenceCategories.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleLicenceCategory(option.value)}
                      aria-pressed={selected}
                      className={`rounded-full px-3 py-1.5 text-left text-xs font-semibold ring-1 transition-colors ${
                        selected
                          ? 'bg-[#E8F3FE] text-[#0B68BE] ring-[#C5DFFB]/80 shadow-[0_2px_8px_rgba(33,142,231,0.12)]'
                          : 'bg-white text-slate-600 ring-slate-200 hover:bg-[#F5FAFF] hover:ring-[#C5DFFB]/70 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-white/10 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Licence Expiry</span>
              <Input
                name="drivingLicenceExpiry"
                type="date"
                value={form.drivingLicenceExpiry}
                onChange={onChange}
                className={fieldInputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">CPC Expiry</span>
              <Input name="cpcExpiry" type="date" value={form.cpcExpiry} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tacho Card Number</span>
              <Input name="tachoCardNumber" value={form.tachoCardNumber} onChange={onChange} className={fieldInputClass} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tacho Card Expiry</span>
              <Input
                name="driverCardExpiry"
                type="date"
                value={form.driverCardExpiry}
                onChange={onChange}
                className={fieldInputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">D4 / Medical Expiry</span>
              <Input
                name="medicalExpiry"
                type="date"
                value={form.medicalExpiry}
                onChange={onChange}
                className={fieldInputClass}
              />
            </label>
          </FormSection>

          <FormSection title="Emergency Contact" description="Optional next-of-kin or emergency contact details.">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Contact Name</span>
              <Input
                name="emergencyContactName"
                value={form.emergencyContactName}
                onChange={onChange}
                className={fieldInputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Contact Phone</span>
              <Input
                name="emergencyContactPhone"
                value={form.emergencyContactPhone}
                onChange={onChange}
                className={fieldInputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Relationship</span>
              <Input
                name="emergencyContactRelationship"
                value={form.emergencyContactRelationship}
                onChange={onChange}
                className={fieldInputClass}
                placeholder="e.g. Partner, Parent, Spouse"
              />
            </label>
          </FormSection>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
              className="h-11 rounded-[16px] bg-gradient-to-br from-[#218EE7] to-[#0B68BE] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(33,142,231,0.22)] transition-all duration-[250ms] ease-out hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
