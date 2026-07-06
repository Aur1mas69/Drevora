import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  ClipboardCheck,
  Droplets,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { buildWorkerDocuments, statusClassMap } from '@/lib/complianceUtils'
import {
  formatConsumableCost,
  formatQuantityWithUnit,
  formatSupplierSite,
} from '@/lib/consumableUtils'
import type { Consumable } from '@/lib/consumableTypes'
import type { ComplianceDocumentItem } from '@/lib/complianceTypes'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
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
import type { Driver } from '@/services/driversService'
import { fetchConsumables } from '@/services/consumablesService'
import { fetchHolidayRequests } from '@/services/holidayRequestsService'
import { fetchTimesheetsByDriverId } from '@/services/timesheetsService'
import { fetchVehicleChecks } from '@/services/vehicleChecksService'
import { fetchWorkerComplianceRecordsByWorkerId } from '@/services/workerComplianceService'
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
  const { formatDate, formatDateTime } = useCompanySettings()
  const [items, setItems] = useState<HolidayRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  return (
    <WorkerProfileTabShell
      isLoading={isLoading}
      errorMessage={errorMessage}
      isEmpty={items.length === 0}
      emptyMessage="No holiday requests found for this worker."
      emptyIcon={CalendarCheck}
      viewAllHref={items.length > 0 ? '/admin/holidays' : undefined}
      viewAllLabel="View all holiday requests"
    >
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className={workerProfileTableHeadClass}>
            <th className="px-5 py-3">Start Date</th>
            <th className="px-5 py-3">End Date</th>
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
              <td className="px-5 py-3.5 text-sm font-medium tabular-nums text-[#3D7A9C]">
                {item.totalDays}
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
  const [items, setItems] = useState<ComplianceDocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const documentsHref = `/compliance/workers/${worker.id}?tab=documents`

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)

    void fetchWorkerComplianceRecordsByWorkerId(worker.id)
      .then((records) => {
        if (cancelled) return
        setItems(buildWorkerDocuments(worker.id, records, [worker]))
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

  const visibleItems = items.filter((item) => item.status !== 'Not Added')

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
                <p className="text-sm font-semibold text-[#113C69]">{item.documentType}</p>
                {item.documentName ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-[#5499BF]/90">
                    {item.documentName}
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-3.5 text-sm font-medium text-[#3D7A9C]">
                {item.expiryDate ? formatDate(item.expiryDate) : '—'}
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusClassMap[item.status]}`}
                >
                  {item.status}
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

function formatConsumableDateTime(item: Consumable, formatDate: (v: string) => string): string {
  if (item.entryTime) {
    return `${formatDate(item.entryDate)} · ${item.entryTime.slice(0, 5)}`
  }
  return formatDate(item.entryDate)
}

function WorkerProfileConsumablesTab({ worker }: { worker: Driver }) {
  const { formatDate } = useCompanySettings()
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
                {formatConsumableDateTime(item, formatDate)}
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
                {formatConsumableCost(item.cost)}
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
