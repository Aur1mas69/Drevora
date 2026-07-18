import { AlertTriangle, CalendarClock } from 'lucide-react'
import { VehicleStatusBadge } from '@/components/vehicles/VehicleStatusBadge'
import {
  vehicleProfileFieldLabelClass,
  vehicleProfileFieldValueClass,
  vehicleProfilePanelClass,
} from '@/components/vehicles/profile/vehicleProfileUi'
import {
  formatShortDate,
  formatStartsInText,
  getDaysUntilDate,
} from '@/lib/vehicleAvailability'
import { getDocumentStatus } from '@/lib/vehiclePageUtils'
import { getNextPlanningEvent, getPlanningEventColor } from '@/lib/vehiclePlanning'
import { getVehicleStatusForDate, type Vehicle } from '@/services/vehiclesService'

type VehicleProfileOverviewTabProps = {
  vehicle: Vehicle
  assignedWorkerLabel: string
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function DetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-slate-900/70">
      <p className={`${vehicleProfileFieldLabelClass} dark:text-slate-400`}>{label}</p>
      <p className={`${vehicleProfileFieldValueClass} dark:text-slate-100`}>{value}</p>
    </div>
  )
}

function ExpiryField({ label, expiry }: { label: string; expiry: string | null }) {
  const status = getDocumentStatus(expiry)
  const toneClass =
    status === 'expired'
      ? 'text-rose-700'
      : status === 'warning'
        ? 'text-amber-800'
        : status === 'valid'
          ? 'text-[#0B68BE]'
          : 'text-[#5499BF]'

  return (
    <div className="rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-slate-900/70">
      <p className={`${vehicleProfileFieldLabelClass} dark:text-slate-400`}>{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${toneClass}`}>{formatDate(expiry)}</p>
    </div>
  )
}

function DocumentWarning({
  label,
  expiry,
}: {
  label: string
  expiry: string | null
}) {
  const status = getDocumentStatus(expiry)
  if (status !== 'expired' && status !== 'warning') return null

  const isExpired = status === 'expired'

  return (
    <div
      className={`flex items-start gap-3 rounded-[14px] border px-4 py-3 ${
        isExpired
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold">
          {label} {isExpired ? 'expired' : 'expiring soon'}
        </p>
        <p className="mt-0.5 text-xs font-medium">
          {formatDate(expiry)}
          {!isExpired && expiry ? ` · ${formatStartsInText(getDaysUntilDate(expiry))}` : ''}
        </p>
      </div>
    </div>
  )
}

export function VehicleProfileOverviewTab({
  vehicle,
  assignedWorkerLabel,
}: VehicleProfileOverviewTabProps) {
  const nextEvent = getNextPlanningEvent(vehicle)
  const currentStatus = getVehicleStatusForDate(vehicle)

  return (
    <div className="space-y-4">
      {(getDocumentStatus(vehicle.motExpiry) !== 'valid' &&
        getDocumentStatus(vehicle.motExpiry) !== 'missing') ||
      (getDocumentStatus(vehicle.insuranceExpiry) !== 'valid' &&
        getDocumentStatus(vehicle.insuranceExpiry) !== 'missing') ? (
        <div className="space-y-2">
          <DocumentWarning label="MOT" expiry={vehicle.motExpiry} />
          <DocumentWarning label="Insurance" expiry={vehicle.insuranceExpiry} />
        </div>
      ) : null}

      {nextEvent ? (
        <div className={`${vehicleProfilePanelClass} p-4 sm:p-5`}>
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#EEF6FF] ring-1 ring-[#C5DFFB]">
              <CalendarClock className="size-4 text-[#218EE7]" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#5499BF]">
                Next event
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.02em] text-white ${getPlanningEventColor(nextEvent)}`}
                >
                  {nextEvent.label === 'Off Road' ? 'OFF ROAD' : nextEvent.label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[#113C69] dark:text-slate-100">
                  {formatShortDate(nextEvent.startDate)}
                </span>
                <span className="text-xs font-semibold text-[#218EE7]">
                  {formatStartsInText(getDaysUntilDate(nextEvent.startDate))}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${vehicleProfilePanelClass} p-4 sm:p-5`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <DetailField label="Registration" value={vehicle.registration} />
          <DetailField label="Fleet number" value={vehicle.fleetNumber ?? 'Not set'} />
          <DetailField label="Type / category" value={vehicle.vehicleType ?? 'Not set'} />
          <DetailField label="Make" value={vehicle.make || 'Not set'} />
          <DetailField label="Model" value={vehicle.model || 'Not set'} />
          <DetailField label="Year" value={vehicle.year ?? 'Not set'} />
          <DetailField label="Assigned worker" value={assignedWorkerLabel} />
          <div className="rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-slate-900/70">
            <p className={`${vehicleProfileFieldLabelClass} dark:text-slate-400`}>Current status</p>
            <div className="mt-2">
              <VehicleStatusBadge status={currentStatus} />
            </div>
          </div>
          <ExpiryField label="MOT expiry" expiry={vehicle.motExpiry} />
          <ExpiryField label="Insurance expiry" expiry={vehicle.insuranceExpiry} />
          <ExpiryField label="Tax expiry" expiry={vehicle.roadTaxExpiry} />
          <ExpiryField label="Tachograph calibration" expiry={vehicle.tachographExpiry} />
          {vehicle.notes ? (
            <div className="rounded-[14px] border border-[#D3E9FC]/80 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-slate-900/70 sm:col-span-2 lg:col-span-3">
              <p className={`${vehicleProfileFieldLabelClass} dark:text-slate-400`}>Notes</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-[#113C69] dark:text-slate-100">
                {vehicle.notes}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
