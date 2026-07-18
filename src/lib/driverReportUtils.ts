import type {
  DriverReport,
  DriverReportFormValues,
  DriverReportKpiFilter,
  DriverReportPriority,
  DriverReportStatus,
  DriverReportsQuery,
  DriverReportSummaryStats,
} from '@/lib/driverReportTypes'
import type { CreateDriverReportInput } from '@/lib/driverReportTypes'
import type { CurrentViewMode } from '@/lib/currentViewVisibility'

export function getDriverReportStatusLabel(status: DriverReportStatus): string {
  return status
}

export const driverReportStatusClassMap: Record<DriverReportStatus, string> = {
  New: 'bg-[#EEF6FF] text-[#0B68BE] ring-[#C5DFFB] dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60',
  'In Progress':
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  Closed:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
}

export const driverReportPriorityClassMap: Record<DriverReportPriority, string> = {
  Low: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
  Medium:
    'bg-[#EEF6FF] text-[#218EE7] ring-[#C5DFFB] dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60',
  High: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:ring-orange-900/60',
  Critical:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
}

export function buildEmptyDriverReportFormValues(): DriverReportFormValues {
  return {
    title: '',
    reportType: 'Other',
    workerId: '',
    vehicleId: '',
    priority: 'Medium',
    status: 'New',
    description: '',
    location: '',
    issueDatetime: '',
    officeNotes: '',
  }
}

export function driverReportToFormValues(report: DriverReport): DriverReportFormValues {
  let issueDatetime = ''
  if (report.issueDatetime) {
    const date = new Date(report.issueDatetime)
    if (!Number.isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0')
      issueDatetime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }

  return {
    title: report.title,
    reportType: report.reportType,
    workerId: report.workerId ?? '',
    vehicleId: report.vehicleId ?? '',
    priority: report.priority,
    status: report.status,
    description: report.description ?? '',
    location: report.location ?? '',
    issueDatetime,
    officeNotes: report.officeNotes ?? '',
  }
}

export type DriverReportFormValidationOptions = {
  requireWorkerSelection: boolean
}

export function validateDriverReportForm(
  values: DriverReportFormValues,
  options: DriverReportFormValidationOptions = { requireWorkerSelection: true },
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!values.title.trim()) errors.title = 'Enter a report title.'
  if (!values.reportType.trim()) errors.reportType = 'Choose a report type.'
  if (options.requireWorkerSelection && !values.workerId.trim()) {
    errors.workerId = 'Select a worker.'
  }
  if (!values.description.trim()) errors.description = 'Describe what happened.'
  return errors
}

export function driverReportFormValuesToInput(
  values: DriverReportFormValues,
): CreateDriverReportInput {
  return {
    title: values.title.trim(),
    reportType: values.reportType.trim(),
    workerId: values.workerId.trim() || null,
    vehicleId: values.vehicleId.trim() || null,
    priority: values.priority,
    status: values.status,
    description: values.description.trim() || null,
    location: values.location.trim() || null,
    issueDatetime: values.issueDatetime.trim()
      ? new Date(values.issueDatetime).toISOString()
      : null,
    officeNotes: values.officeNotes.trim() || null,
  }
}

export function computeDriverReportSummaryStats(reports: DriverReport[]): DriverReportSummaryStats {
  const activeCurrent = reports.filter(
    (r) => !r.cleanedAt && (r.status === 'New' || r.status === 'In Progress'),
  )

  return {
    newReports: activeCurrent.filter((r) => r.status === 'New').length,
    inProgress: activeCurrent.filter((r) => r.status === 'In Progress').length,
    closed: reports.filter((r) => r.status === 'Closed').length,
    criticalHigh: activeCurrent.filter(
      (r) => r.priority === 'High' || r.priority === 'Critical',
    ).length,
  }
}

function matchesKpiFilter(report: DriverReport, kpi: DriverReportKpiFilter): boolean {
  switch (kpi) {
    case 'new':
      return report.status === 'New'
    case 'in_progress':
      return report.status === 'In Progress'
    case 'closed':
      return report.status === 'Closed'
    case 'critical_high':
      return report.priority === 'High' || report.priority === 'Critical'
    default:
      return true
  }
}

export function filterDriverReports(reports: DriverReport[], query: DriverReportsQuery): DriverReport[] {
  let result = reports

  if (query.kpiFilter && query.kpiFilter !== 'all') {
    result = result.filter((report) => matchesKpiFilter(report, query.kpiFilter!))
  }

  if (query.status && query.status !== 'all') {
    result = result.filter((report) => report.status === query.status)
  }

  if (query.reportType && query.reportType !== 'all') {
    result = result.filter((report) => report.reportType === query.reportType)
  }

  if (query.priority && query.priority !== 'all') {
    if (query.priority === 'critical_high') {
      result = result.filter(
        (report) => report.priority === 'High' || report.priority === 'Critical',
      )
    } else {
      result = result.filter((report) => report.priority === query.priority)
    }
  }

  if (query.workerId && query.workerId !== 'all') {
    result = result.filter((report) => report.workerId === query.workerId)
  }

  if (query.vehicleId && query.vehicleId !== 'all') {
    result = result.filter((report) => report.vehicleId === query.vehicleId)
  }

  if (query.dateFrom) {
    result = result.filter((report) => report.createdAt.slice(0, 10) >= query.dateFrom!)
  }

  if (query.dateTo) {
    result = result.filter((report) => report.createdAt.slice(0, 10) <= query.dateTo!)
  }

  const search = query.search?.trim().toLowerCase()
  if (search) {
    result = result.filter((report) => {
      const haystack = [
        report.title,
        report.description,
        report.location,
        report.workerName,
        report.vehicleLabel,
        report.reportType,
        report.officeNotes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  return result
}

export function filterDriverReportsByVisibility(
  reports: DriverReport[],
  visibilityMode: CurrentViewMode,
): DriverReport[] {
  if (visibilityMode === 'all') return reports
  if (visibilityMode === 'history') {
    return reports.filter((report) => report.status === 'Closed' || Boolean(report.cleanedAt))
  }
  // Current: open reports that have not been cleaned from the active view
  return reports.filter(
    (report) =>
      !report.cleanedAt && (report.status === 'New' || report.status === 'In Progress'),
  )
}

export function getReportDescriptionSnippet(description: string | null, maxLength = 72): string {
  const text = description?.trim()
  if (!text) return 'No description provided.'
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}…`
}

export function hasDriverReportAttachment(report: DriverReport): boolean {
  return Boolean(report.attachmentPath?.trim() || report.attachmentUrl?.trim())
}
