import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  CalendarDays,
  MapPin,
  PhoneCall,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { WorkerCodeBadge } from '@/components/workers/WorkerCodeBadge'
import { WorkerEmploymentTypeBadge } from '@/components/workers/WorkerEmploymentTypeBadge'
import { WorkerExpiryDateValue } from '@/components/workers/WorkerExpiryDateValue'
import {
  formatLicenceCategories,
  formatWorkerProfileDate,
  getWorkerDefaultVehicleLabel,
  isWorkerAddressEmpty,
} from '@/lib/workerProfileUtils'
import type { Driver, DriverStatus } from '@/services/driversService'
import { fetchWorkerHolidayBalanceSummary } from '@/services/holidayRequestsService'
import type { HolidayBalanceSummary } from '@/lib/holidayRequestTypes'
import { cn } from '@/lib/utils'

const profileSectionCardClass =
  'rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 p-4 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BFE3F5] hover:shadow-[0_8px_22px_rgba(33,142,231,0.1)] active:translate-y-0 dark:border-white/10 dark:from-slate-900/70 dark:to-slate-900/60'

function ProfileEmptyValue({ children = 'Not set' }: { children?: string }) {
  return <span className="text-sm font-medium text-slate-400">{children}</span>
}

function ProfileField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5499BF]/85">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-sm font-semibold leading-snug text-[#113C69] dark:text-slate-100">
        {children}
      </div>
    </div>
  )
}

function ProfileSectionCard({
  title,
  icon: Icon,
  children,
  className,
  contentClassName,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section className={cn(profileSectionCardClass, className)}>
      <div className="mb-3 flex items-center gap-2.5 border-b border-[#D3E9FC]/50 pb-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#E8F3FE] text-[#0B68BE] ring-1 ring-[#C5DFFB]/60">
          <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#113C69] dark:text-slate-100">
          {title}
        </h3>
      </div>
      <div className={cn('grid gap-x-5 gap-y-3.5 sm:grid-cols-2', contentClassName)}>
        {children}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: DriverStatus }) {
  const classMap: Record<DriverStatus, string> = {
    Working: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'Off Duty': 'bg-slate-100 text-slate-600 ring-slate-200',
    Holiday: 'bg-orange-50 text-orange-700 ring-orange-200',
    Suspended: 'bg-rose-50 text-rose-700 ring-rose-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${classMap[status]}`}
    >
      {status}
    </span>
  )
}

function ComplianceDateField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <ProfileField label={label}>
      <WorkerExpiryDateValue value={value} emphasized />
    </ProfileField>
  )
}

type WorkerProfileOverviewProps = {
  driver: Driver
}

export function WorkerProfileOverview({ driver }: WorkerProfileOverviewProps) {
  const [holidayBalance, setHolidayBalance] = useState<HolidayBalanceSummary | null>(null)
  const fullName = `${driver.firstName} ${driver.lastName}`.trim()
  const licenceCategories = formatLicenceCategories(driver.licenceCategories)
  const defaultVehicle = getWorkerDefaultVehicleLabel(driver)
  const hasAddress = !isWorkerAddressEmpty(driver)
  const paidDays = driver.annualPaidHolidayDays ?? 0
  const bankDays = driver.bankHolidayEntitlementDays ?? 0
  const totalEntitlement = driver.paidHolidayEnabled === false ? 0 : paidDays + bankDays

  useEffect(() => {
    let isCancelled = false
    void fetchWorkerHolidayBalanceSummary(driver.id)
      .then((balance) => {
        if (!isCancelled) setHolidayBalance(balance)
      })
      .catch(() => {
        if (!isCancelled) setHolidayBalance(null)
      })

    return () => {
      isCancelled = true
    }
  }, [driver.id])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileSectionCard title="Basic Details" icon={UserRound}>
          <ProfileField label="Worker ID">
            <WorkerCodeBadge code={driver.workerCode} emptyLabel="No Worker ID" />
          </ProfileField>
          <ProfileField label="Full Name">{fullName}</ProfileField>
          <ProfileField label="Email">
            {driver.email ? driver.email : <ProfileEmptyValue />}
          </ProfileField>
          <ProfileField label="Phone">
            {driver.phone ? driver.phone : <ProfileEmptyValue />}
          </ProfileField>
          <ProfileField label="Company" className="sm:col-span-2">
            {driver.company ? driver.company : <ProfileEmptyValue />}
          </ProfileField>
        </ProfileSectionCard>

        <ProfileSectionCard title="Work Details" icon={Briefcase}>
          <ProfileField label="Role">{driver.role}</ProfileField>
          <ProfileField label="Employment Type">
            <WorkerEmploymentTypeBadge employmentType={driver.employmentType} />
          </ProfileField>
          <ProfileField label="Status">
            <StatusBadge status={driver.status} />
          </ProfileField>
          <ProfileField label="Default Vehicle">
            {defaultVehicle === 'Not assigned' ? (
              <ProfileEmptyValue />
            ) : (
              defaultVehicle
            )}
          </ProfileField>
          <ProfileField label="Start Date">
            {driver.startDate ? (
              formatWorkerProfileDate(driver.startDate)
            ) : (
              <ProfileEmptyValue />
            )}
          </ProfileField>
        </ProfileSectionCard>
      </div>

      <ProfileSectionCard title="Holiday Entitlement" icon={CalendarDays}>
        <ProfileField label="Paid holiday enabled">
          {driver.paidHolidayEnabled === null ? (
            <ProfileEmptyValue>Use Employment Type default</ProfileEmptyValue>
          ) : driver.paidHolidayEnabled ? (
            'Yes'
          ) : (
            'No'
          )}
        </ProfileField>
        <ProfileField label="Annual paid holiday days">
          {driver.annualPaidHolidayDays == null ? <ProfileEmptyValue>Use default</ProfileEmptyValue> : driver.annualPaidHolidayDays}
        </ProfileField>
        <ProfileField label="Bank holiday entitlement">
          {driver.bankHolidayEntitlementDays == null ? <ProfileEmptyValue>Use default</ProfileEmptyValue> : driver.bankHolidayEntitlementDays}
        </ProfileField>
        <ProfileField label="Total entitlement">{totalEntitlement}</ProfileField>
        <ProfileField label="Used approved paid holiday">
          {holidayBalance ? holidayBalance.usedHolidayDays : <ProfileEmptyValue />}
        </ProfileField>
        <ProfileField label="Pending paid holiday">
          {holidayBalance ? holidayBalance.pendingHolidayDays : <ProfileEmptyValue />}
        </ProfileField>
        <ProfileField label="Remaining paid holiday">
          {holidayBalance && holidayBalance.allowanceKnown && Number.isFinite(holidayBalance.remainingBeforeRequest)
            ? holidayBalance.remainingBeforeRequest
            : <ProfileEmptyValue />}
        </ProfileField>
        <ProfileField label="Unpaid leave allowed">{driver.unpaidLeaveAllowed ? 'Yes' : 'No'}</ProfileField>
        <ProfileField label="Notes" className="sm:col-span-2">
          {driver.holidayEntitlementNotes ? driver.holidayEntitlementNotes : <ProfileEmptyValue />}
        </ProfileField>
      </ProfileSectionCard>

      <ProfileSectionCard title="Address" icon={MapPin} className="lg:max-w-2xl">
        {hasAddress ? (
          <>
            <ProfileField label="Address Line 1" className="sm:col-span-2">
              {driver.addressLine1 ? driver.addressLine1 : <ProfileEmptyValue />}
            </ProfileField>
            <ProfileField label="Address Line 2" className="sm:col-span-2">
              {driver.addressLine2 ? driver.addressLine2 : <ProfileEmptyValue />}
            </ProfileField>
            <ProfileField label="Town / City">
              {driver.townCity ? driver.townCity : <ProfileEmptyValue />}
            </ProfileField>
            <ProfileField label="County">
              {driver.county ? driver.county : <ProfileEmptyValue />}
            </ProfileField>
            <ProfileField label="Postcode">
              {driver.postcode ? driver.postcode : <ProfileEmptyValue />}
            </ProfileField>
            <ProfileField label="Country">
              {driver.country ? driver.country : <ProfileEmptyValue />}
            </ProfileField>
          </>
        ) : (
          <p className="text-sm font-medium text-slate-400 sm:col-span-2">No address added</p>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Licence & Compliance"
        icon={ShieldCheck}
        contentClassName="sm:grid-cols-2 lg:grid-cols-3"
      >
        <ProfileField label="Licence Categories" className="sm:col-span-2 lg:col-span-3">
          {licenceCategories === 'Not set' ? (
            <ProfileEmptyValue />
          ) : (
            licenceCategories
          )}
        </ProfileField>
        <ComplianceDateField label="Licence Expiry" value={driver.drivingLicenceExpiry} />
        <ComplianceDateField label="CPC Expiry" value={driver.cpcExpiry} />
        <ComplianceDateField label="Tacho Card Expiry" value={driver.driverCardExpiry} />
        <ProfileField label="Tacho Card Number">
          {driver.tachoCardNumber ? driver.tachoCardNumber : <ProfileEmptyValue />}
        </ProfileField>
        <ComplianceDateField
          label="D4 / Medical Expiry"
          value={driver.medicalExpiry}
        />
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Emergency Contact"
        icon={PhoneCall}
        className="lg:max-w-2xl"
      >
        <ProfileField label="Contact Name">
          {driver.emergencyContactName ? (
            driver.emergencyContactName
          ) : (
            <ProfileEmptyValue />
          )}
        </ProfileField>
        <ProfileField label="Contact Phone">
          {driver.emergencyContactPhone ? (
            driver.emergencyContactPhone
          ) : (
            <ProfileEmptyValue />
          )}
        </ProfileField>
        <ProfileField label="Relationship" className="sm:col-span-2">
          {driver.emergencyContactRelationship ? (
            driver.emergencyContactRelationship
          ) : (
            <ProfileEmptyValue />
          )}
        </ProfileField>
      </ProfileSectionCard>
    </div>
  )
}
