import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  ClipboardCheck,
  Droplets,
  FileText,
  Pencil,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_HOLIDAY_ENTITLEMENT_RULES,
  type HolidayEntitlementRule,
} from '@/lib/companySettingsTypes'
import type { Document } from '@/lib/documentTypes'
import {
  documentStatusClassMap,
  getDocumentStatusLabel,
} from '@/lib/documentUtils'
import {
  formatConsumableItemCost,
  formatConsumableEntryDateTime,
  formatQuantityWithUnit,
  formatSupplierSite,
} from '@/lib/consumableUtils'
import type { Consumable } from '@/lib/consumableTypes'
import {
  calculatePaidHolidayRemaining,
  resolvePaidHolidayEntitlementDays,
} from '@/lib/holidayEntitlement'
import type { HolidayBalanceSummary, HolidayRequest } from '@/lib/holidayRequestTypes'
import { getStatusBadgeClass as getHolidayStatusBadgeClass } from '@/lib/holidayRequestUtils'
import type { TimesheetListItem } from '@/lib/timesheetTypes'
import {
  formatSubmittedAtDisplay,
  getStatusBadgeClass as getTimesheetStatusBadgeClass,
  getStatusLabel as getTimesheetStatusLabel,
  formatHours,
} from '@/lib/timesheetUtils'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'
import { getResultBadgeClass } from '@/lib/vehicleCheckUtils'
import {
  formatVehicleCheckResultLabel,
  WORKER_PROFILE_HISTORY_LIMIT,
} from '@/lib/workerProfileUtils'
import type {
  Driver,
  UpdateWorkerHolidayEntitlementInput,
} from '@/services/driversService'
import { updateWorkerHolidayEntitlement } from '@/services/driversService'
import { fetchConsumables } from '@/services/consumablesService'
import {
  fetchHolidayRequests,
  fetchWorkerHolidayBalanceSummary,
} from '@/services/holidayRequestsService'
import { fetchTimesheetsByDriverId } from '@/services/timesheetsService'
import { fetchVehicleChecks } from '@/services/vehicleChecksService'
import { fetchDocumentsByWorkerId } from '@/services/documentsService'
import {
  WorkerProfileTabShell,
  workerProfileTableHeadClass,
  workerProfileTableRowClass,
} from '@/components/workers/profile/WorkerProfileTabShell'

export type WorkerProfileHistoryTab =
  | 'Timesheets'
  | 'Holidays'
  | 'Vehicle Checks'
  | 'Documents'
  | 'Consumables'

type WorkerProfileHistoryTabsProps = {
  worker: Driver
  activeTab: WorkerProfileHistoryTab
}

function ProfileViewLink({ to, label }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="text-sm font-semibold text-[#218EE7] transition-colors hover:text-[#0B68BE]"
    >
      {label ?? 'View'}
    </Link>
  )
}

function formatDayCount(value: number): string {
  return `${value} day${value === 1 ? '' : 's'}`
}

function getLeaveTypeLabel(request: HolidayRequest): string {
  if (request.leaveType === 'unpaid_leave') return 'Unpaid leave'
  if (request.leaveType === 'bank_holiday') return 'Bank holiday'
  return 'Paid holiday'
}

function HolidayLeaveTypeBadge({ request }: { request: HolidayRequest }) {
  const className =
    request.leaveType === 'unpaid_leave'
      ? 'bg-slate-100 text-slate-700 ring-slate-200'
      : request.leaveType === 'bank_holiday'
        ? 'bg-blue-50 text-blue-700 ring-blue-100'
        : 'bg-teal-50 text-teal-700 ring-teal-100'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${className}`}>
      {getLeaveTypeLabel(request)}
    </span>
  )
}

function getWorkerEntitlementRule(worker: Driver, rules: Record<string, HolidayEntitlementRule>) {
  const key =
    worker.employmentType && worker.employmentType in rules ? worker.employmentType : 'Other'
  return rules[key] ?? DEFAULT_HOLIDAY_ENTITLEMENT_RULES.Other
}

function HolidayEntitlementTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div
      className={`rounded-[14px] border px-3 py-2 ${
        tone === 'warning'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-[#D3E9FC] bg-white/75 text-[#113C69]'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function HolidayEntitlementEditModal({
  worker,
  isSaving,
  errorMessage,
  onClose,
  onSubmit,
}: {
  worker: Driver
  isSaving: boolean
  errorMessage: string | null
  onClose: () => void
  onSubmit: (values: UpdateWorkerHolidayEntitlementInput) => Promise<void>
}) {
  const [values, setValues] = useState<UpdateWorkerHolidayEntitlementInput>({
    paidHolidayEnabled: worker.paidHolidayEnabled,
    annualPaidHolidayDays: worker.annualPaidHolidayDays == null ? '' : String(worker.annualPaidHolidayDays),
    bankHolidayEntitlementDays:
      worker.bankHolidayEntitlementDays == null ? '' : String(worker.bankHolidayEntitlementDays),
    unpaidLeaveAllowed: worker.unpaidLeaveAllowed,
    holidayEntitlementNotes: worker.holidayEntitlementNotes ?? '',
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit(values)
  }

  const inputClass =
    'mt-1.5 h-10 w-full rounded-[12px] border border-[#D3E9FC] bg-[#F8FBFF] px-3 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors focus:border-[#218EE7] focus:ring-2 focus:ring-[#E8F3FE]'

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-[18px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#218EE7]">
              Holiday Entitlement
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#113C69]">
              Edit entitlement
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-[10px] text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-[12px] bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Paid holiday enabled
            <select
              value={values.paidHolidayEnabled === null ? '' : String(values.paidHolidayEnabled)}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  paidHolidayEnabled:
                    event.target.value === ''
                      ? null
                      : event.target.value === 'true',
                }))
              }
              className={inputClass}
            >
              <option value="">Use default</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Annual paid holiday days
            <Input
              type="number"
              min={0}
              step="0.5"
              value={values.annualPaidHolidayDays}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  annualPaidHolidayDays: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Use default"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Bank holiday entitlement days
            <Input
              type="number"
              min={0}
              step="0.5"
              value={values.bankHolidayEntitlementDays}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  bankHolidayEntitlementDays: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Use default"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Unpaid leave allowed
            <select
              value={String(values.unpaidLeaveAllowed)}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  unpaidLeaveAllowed: event.target.value === 'true',
                }))
              }
              className={inputClass}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Holiday entitlement notes
            <Input
              value={values.holidayEntitlementNotes}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  holidayEntitlementNotes: event.target.value,
                }))
              }
              className={inputClass}
              placeholder="Optional notes"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} className="bg-[#218EE7] text-white hover:bg-[#0B68BE]">
            {isSaving ? 'Saving...' : 'Save entitlement'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function WorkerProfileTimesheetsTab({ worker }: { worker: Driver }) {
  const [items, setItems] = useState<TimesheetListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchTimesheetsByDriverId(worker.id, {
      pageSize: WORKER_PROFILE_HISTORY_LIMIT,
    })
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Unable to load timesheets for this worker.')
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [worker.id])

  return (
    <WorkerProfileTabShell
      isLoading={isLoading}
      errorMessage={errorMessage}
      isEmpty={items.length === 0}
      emptyMessage="No timesheets found for this worker."
      emptyIcon={ClipboardCheck}
      viewAllHref={items.length > 0 ? '/admin/timesheets' : undefined}
      viewAllLabel="View all timesheets"
    >
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className={workerProfileTableHeadClass}>
            <th className="px-5 py-3">Week</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Total Hours</th>
            <th className="px-5 py-3">Submitted</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={workerProfileTableRowClass}>
              <td className="px-5 py-3.5">
                <p className="text-sm font-semibold text-[#113C69]">{item.weekRangeLabel}</p>
                <p className="mt-0.5 text-xs font-medium text-[#5499BF]/90">
                  {item.weekTitle}
                </p>
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getTimesheetStatusBadgeClass(item.status)}`}
                >
                  {getTimesheetStatusLabel(item.status)}
                </span>
              </td>
              <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#113C69]">
                {formatHours(item.totalHours)}
              </td>
              <td className="px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                {formatSubmittedAtDisplay(item.submittedAt, item.status)}
              </td>
              <td className="px-5 py-3.5 text-right">
                <ProfileViewLink to="/admin/timesheets" label="Open" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkerProfileTabShell>
  )
}

function WorkerProfileHolidaysTab({ worker }: { worker: Driver }) {
  const { formatDate, formatDateTime, settings } = useCompanySettings()
  const [entitlementWorker, setEntitlementWorker] = useState(worker)
  const [balance, setBalance] = useState<HolidayBalanceSummary | null>(null)
  const [items, setItems] = useState<HolidayRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingEntitlement, setIsSavingEntitlement] = useState(false)
  const [entitlementError, setEntitlementError] = useState<string | null>(null)

  useEffect(() => {
    setEntitlementWorker(worker)
  }, [worker])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchHolidayRequests({
      workerId: worker.id,
      page: 1,
      pageSize: WORKER_PROFILE_HISTORY_LIMIT,
    })
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Unable to load holiday requests for this worker.')
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [worker.id])

  useEffect(() => {
    let cancelled = false
    void fetchWorkerHolidayBalanceSummary(worker.id)
      .then((result) => {
        if (!cancelled) setBalance(result)
      })
      .catch(() => {
        if (!cancelled) setBalance(null)
      })

    return () => {
      cancelled = true
    }
  }, [worker.id, entitlementWorker])

  async function handleSaveEntitlement(values: UpdateWorkerHolidayEntitlementInput) {
    setIsSavingEntitlement(true)
    setEntitlementError(null)

    try {
      const updated = await updateWorkerHolidayEntitlement(worker.id, values)
      setEntitlementWorker(updated)
      setIsEditModalOpen(false)
    } catch (error) {
      setEntitlementError(
        error instanceof Error ? error.message : 'Unable to save holiday entitlement.',
      )
    } finally {
      setIsSavingEntitlement(false)
    }
  }

  const rules = settings?.holidayEntitlementRules ?? DEFAULT_HOLIDAY_ENTITLEMENT_RULES
  const rule = getWorkerEntitlementRule(entitlementWorker, rules)
  const paidHolidayEnabled = entitlementWorker.paidHolidayEnabled ?? rule.paidHolidayEnabled
  const annualPaidHolidayDays =
    entitlementWorker.annualPaidHolidayDays ?? rule.annualPaidHolidayDays
  const bankHolidayEntitlementDays =
    entitlementWorker.bankHolidayEntitlementDays ?? rule.bankHolidayEntitlementDays
  const unpaidLeaveAllowed = entitlementWorker.unpaidLeaveAllowed ?? rule.unpaidLeaveAllowed
  const paidHolidayEntitlement = resolvePaidHolidayEntitlementDays(
    paidHolidayEnabled,
    annualPaidHolidayDays,
  )
  const usedPaidHoliday = balance?.usedHolidayDays ?? 0
  const pendingPaidHoliday = balance?.pendingHolidayDays ?? 0
  const calculatedRemaining = calculatePaidHolidayRemaining({
    annualPaidHolidayDays: paidHolidayEntitlement,
    usedPaidHoliday,
    pendingPaidHoliday,
  })
  const remainingPaidHoliday =
    balance && Number.isFinite(balance.remainingBeforeRequest)
      ? balance.remainingBeforeRequest
      : calculatedRemaining.remainingPaidHoliday
  const remainingAfterPending =
    balance && Number.isFinite(balance.remainingAfterPendingRequests)
      ? balance.remainingAfterPendingRequests
      : calculatedRemaining.remainingAfterPending
  const allowanceExceeded = remainingPaidHoliday < 0 || remainingAfterPending < 0

  return (
    <div className="space-y-4">
      <section className="mx-auto max-w-6xl rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/88 p-5 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#218EE7]">
              Holiday Entitlement
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#113C69]">
              Manage this worker’s paid holiday allowance and leave balance.
            </h3>
          </div>
          <Button
            type="button"
            onClick={() => {
              setEntitlementError(null)
              setIsEditModalOpen(true)
            }}
            className="h-9 rounded-[12px] bg-[#218EE7] px-3 text-sm font-semibold text-white hover:bg-[#0B68BE]"
          >
            <Pencil className="size-4" />
            Edit entitlement
          </Button>
        </div>

        {!paidHolidayEnabled ? (
          <div className="mt-4 rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            This worker is not eligible for paid holiday. Leave can still be recorded as unpaid leave.
          </div>
        ) : null}

        {allowanceExceeded ? (
          <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Allowance exceeded. Managers can still record leave.
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HolidayEntitlementTile label="Paid holiday enabled" value={paidHolidayEnabled ? 'Yes' : 'No'} />
          <HolidayEntitlementTile label="Annual paid holiday days" value={formatDayCount(annualPaidHolidayDays)} />
          <HolidayEntitlementTile label="Bank holiday entitlement" value={formatDayCount(bankHolidayEntitlementDays)} />
          <HolidayEntitlementTile label="Paid holiday entitlement" value={formatDayCount(paidHolidayEntitlement)} />
          <HolidayEntitlementTile label="Used paid holiday" value={formatDayCount(balance?.usedHolidayDays ?? 0)} />
          <HolidayEntitlementTile label="Pending paid holiday" value={formatDayCount(balance?.pendingHolidayDays ?? 0)} />
          <HolidayEntitlementTile
            label="Remaining paid holiday"
            value={formatDayCount(remainingPaidHoliday)}
            tone={remainingPaidHoliday < 0 ? 'warning' : 'default'}
          />
          <HolidayEntitlementTile
            label="Remaining after pending"
            value={formatDayCount(remainingAfterPending)}
            tone={remainingAfterPending < 0 ? 'warning' : 'default'}
          />
          <HolidayEntitlementTile label="Unpaid leave allowed" value={unpaidLeaveAllowed ? 'Yes' : 'No'} />
          {entitlementWorker.holidayEntitlementNotes ? (
            <div className="rounded-[14px] border border-[#D3E9FC] bg-white/75 px-3 py-2 text-[#113C69] sm:col-span-2 lg:col-span-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]">
                Notes
              </p>
              <p className="mt-1 text-sm font-semibold">{entitlementWorker.holidayEntitlementNotes}</p>
            </div>
          ) : null}
        </div>
        {paidHolidayEnabled ? (
          <p className="mt-3 text-xs leading-5 text-[#5499BF]">
            Bank holidays are tracked separately and are not included in remaining paid holiday.
          </p>
        ) : null}
      </section>

      <WorkerProfileTabShell
        isLoading={isLoading}
        errorMessage={errorMessage}
        isEmpty={items.length === 0}
        emptyMessage="No holiday requests found for this worker."
        emptyIcon={CalendarCheck}
        viewAllHref={items.length > 0 ? '/admin/holidays' : undefined}
        viewAllLabel="View all holiday requests"
      >
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className={workerProfileTableHeadClass}>
              <th className="px-5 py-3">Start Date</th>
              <th className="px-5 py-3">End Date</th>
              <th className="px-5 py-3">Leave Type</th>
              <th className="px-5 py-3">Days</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Requested</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={workerProfileTableRowClass}>
                <td className="px-5 py-3.5 text-sm font-semibold text-[#113C69]">
                  {formatDate(item.startDate)}
                </td>
                <td className="px-5 py-3.5 text-sm font-semibold text-[#113C69]">
                  {formatDate(item.endDate)}
                </td>
                <td className="px-5 py-3.5">
                  <HolidayLeaveTypeBadge request={item} />
                </td>
                <td className="px-5 py-3.5 text-sm font-medium tabular-nums text-[#3D7A9C]">
                  <p>Holiday deducted: {item.holidayDaysDeducted}</p>
                  <p className="mt-0.5 text-xs text-[#5499BF]">Calendar away: {item.calendarDaysTotal}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getHolidayStatusBadgeClass(item.status)}`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                  {formatDateTime(item.createdAt)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <ProfileViewLink to="/admin/holidays" label="Open" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </WorkerProfileTabShell>

      {isEditModalOpen ? (
        <HolidayEntitlementEditModal
          worker={entitlementWorker}
          isSaving={isSavingEntitlement}
          errorMessage={entitlementError}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleSaveEntitlement}
        />
      ) : null}
    </div>
  )
}

function formatVehicleCheckDefectsSummary(check: VehicleCheckListItem): string {
  if (check.failCount > 0) {
    return `${check.failCount} defect${check.failCount === 1 ? '' : 's'}`
  }
  if (check.notes?.trim()) {
    return check.notes.trim()
  }
  return '—'
}

function WorkerProfileVehicleChecksTab({ worker }: { worker: Driver }) {
  const { formatDate, formatDateTime } = useCompanySettings()
  const [items, setItems] = useState<VehicleCheckListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchVehicleChecks({
      workerId: worker.id,
      page: 1,
      pageSize: WORKER_PROFILE_HISTORY_LIMIT,
    })
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Unable to load vehicle checks for this worker.')
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [worker.id])

  return (
    <WorkerProfileTabShell
      isLoading={isLoading}
      errorMessage={errorMessage}
      isEmpty={items.length === 0}
      emptyMessage="No vehicle checks found for this worker."
      emptyIcon={ShieldCheck}
      viewAllHref={items.length > 0 ? '/admin/vehicle-checks' : undefined}
      viewAllLabel="View all vehicle checks"
    >
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className={workerProfileTableHeadClass}>
            <th className="px-5 py-3">Date / Time</th>
            <th className="px-5 py-3">Vehicle</th>
            <th className="px-5 py-3">Result</th>
            <th className="px-5 py-3">Issues</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={workerProfileTableRowClass}>
              <td className="px-5 py-3.5">
                <p className="text-sm font-semibold text-[#113C69]">
                  {formatDate(item.inspectionDate)}
                </p>
                <p className="mt-0.5 text-xs font-medium text-[#5499BF]/90">
                  {formatDateTime(item.createdAt)}
                </p>
              </td>
              <td className="px-5 py-3.5">
                <p className="text-sm font-semibold text-[#113C69]">
                  {item.vehicleRegistration}
                </p>
                {item.fleetNumber ? (
                  <p className="mt-0.5 text-xs font-medium text-[#5499BF]/90">
                    Fleet {item.fleetNumber}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getResultBadgeClass(item.overallResult)}`}
                >
                  {formatVehicleCheckResultLabel(item.overallResult)}
                </span>
              </td>
              <td className="max-w-[220px] px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                <p className="truncate">{formatVehicleCheckDefectsSummary(item)}</p>
              </td>
              <td className="px-5 py-3.5 text-right">
                <ProfileViewLink to="/admin/vehicle-checks" label="Open" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkerProfileTabShell>
  )
}

function WorkerProfileDocumentsTab({ worker }: { worker: Driver }) {
  const { formatDate } = useCompanySettings()
  const [items, setItems] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const documentsHref = `/documents?tab=workers&workerId=${worker.id}`

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchDocumentsByWorkerId(worker.id)
      .then((records) => {
        if (cancelled) return
        setItems(records)
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Unable to load documents for this worker.')
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [worker])

  const visibleItems = items

  return (
    <WorkerProfileTabShell
      isLoading={isLoading}
      errorMessage={errorMessage}
      isEmpty={visibleItems.length === 0}
      emptyMessage="No documents found for this worker."
      emptyIcon={FileText}
      viewAllHref={visibleItems.length > 0 ? documentsHref : undefined}
      viewAllLabel="Manage documents"
    >
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className={workerProfileTableHeadClass}>
            <th className="px-5 py-3">Document</th>
            <th className="px-5 py-3">Expiry</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item) => (
            <tr key={item.id} className={workerProfileTableRowClass}>
              <td className="px-5 py-3.5">
                <p className="text-sm font-semibold text-[#113C69]">{item.documentName}</p>
                {item.documentType ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-[#5499BF]/90">
                    {item.documentType}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                {item.expiryDate ? formatDate(item.expiryDate) : '—'}
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap[item.status]}`}
                >
                  {getDocumentStatusLabel(item.status)}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <ProfileViewLink to={documentsHref} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkerProfileTabShell>
  )
}

function formatConsumableDateTime(
  item: Consumable,
  formatDate: (value: string) => string,
  formatTime: (value: string) => string,
): string {
  return formatConsumableEntryDateTime(item.entryDate, item.entryTime, formatDate, formatTime)
}

function WorkerProfileConsumablesTab({ worker }: { worker: Driver }) {
  const { formatDate, formatTime, settings } = useCompanySettings()
  const defaultPrices = settings?.consumableDefaultPrices ?? {}
  const [items, setItems] = useState<Consumable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchConsumables({
      workerId: worker.id,
      page: 1,
      pageSize: WORKER_PROFILE_HISTORY_LIMIT,
    })
      .then((result) => {
        if (cancelled) return
        setItems(result.items)
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Unable to load consumables for this worker.')
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [worker.id])

  return (
    <WorkerProfileTabShell
      isLoading={isLoading}
      errorMessage={errorMessage}
      isEmpty={items.length === 0}
      emptyMessage="No consumables found for this worker."
      emptyIcon={Droplets}
      viewAllHref={items.length > 0 ? '/consumables' : undefined}
      viewAllLabel="View all consumables"
    >
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr className={workerProfileTableHeadClass}>
            <th className="px-5 py-3">Date / Time</th>
            <th className="px-5 py-3">Vehicle</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Item / Fluid</th>
            <th className="px-5 py-3">Quantity</th>
            <th className="px-5 py-3">Cost</th>
            <th className="px-5 py-3">Supplier / Site</th>
            <th className="px-5 py-3">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={workerProfileTableRowClass}>
              <td className="px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                {formatConsumableDateTime(item, formatDate, formatTime)}
              </td>
              <td className="px-5 py-3.5 text-sm font-semibold text-[#113C69]">
                {item.vehicleLabel ?? '—'}
              </td>
              <td className="px-5 py-3.5 text-sm font-semibold text-[#113C69]">
                {item.consumableType}
              </td>
              <td className="max-w-[160px] px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                <p className="truncate">{item.itemName ?? '—'}</p>
              </td>
              <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#113C69]">
                {formatQuantityWithUnit(item.quantity, item.unit)}
              </td>
              <td className="px-5 py-3.5 text-sm font-semibold text-[#0B68BE]">
                {formatConsumableItemCost(item, defaultPrices)}
              </td>
              <td className="max-w-[180px] px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                <p className="truncate">
                  {formatSupplierSite(item.supplier, item.site) || '—'}
                </p>
              </td>
              <td className="px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                {item.receiptUrl ? 'Yes' : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WorkerProfileTabShell>
  )
}

export function WorkerProfileHistoryTabs({
  worker,
  activeTab,
}: WorkerProfileHistoryTabsProps) {
  switch (activeTab) {
    case 'Timesheets':
      return <WorkerProfileTimesheetsTab worker={worker} />
    case 'Holidays':
      return <WorkerProfileHolidaysTab worker={worker} />
    case 'Vehicle Checks':
      return <WorkerProfileVehicleChecksTab worker={worker} />
    case 'Documents':
      return <WorkerProfileDocumentsTab worker={worker} />
    case 'Consumables':
      return <WorkerProfileConsumablesTab worker={worker} />
    default:
      return null
  }
}
