export const DRIVER_REPORT_TYPES = [
  'Vehicle issue',
  'Damage',
  'Load / cargo issue',
  'Site / customer issue',
  'Health & safety',
  'Delay / operational issue',
  'Other',
] as const

export type DriverReportType = (typeof DRIVER_REPORT_TYPES)[number]

export const DRIVER_REPORT_STATUSES = ['New', 'In Progress', 'Closed'] as const

export type DriverReportStatus = (typeof DRIVER_REPORT_STATUSES)[number]

export const DRIVER_REPORT_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

export type DriverReportPriority = (typeof DRIVER_REPORT_PRIORITIES)[number]

export type DriverReport = {
  id: string
  company: string | null
  workerId: string | null
  workerName: string | null
  vehicleId: string | null
  vehicleLabel: string | null
  title: string
  reportType: DriverReportType | string
  priority: DriverReportPriority
  status: DriverReportStatus
  description: string | null
  location: string | null
  issueDatetime: string | null
  officeNotes: string | null
  attachmentUrl: string | null
  attachmentPath: string | null
  createdAt: string
  updatedAt: string
}

export type DriverReportStatusFilter = DriverReportStatus | 'all'
export type DriverReportTypeFilter = DriverReportType | string | 'all'
export type DriverReportPriorityFilter = DriverReportPriority | 'all' | 'critical_high'

export type DriverReportKpiFilter =
  | 'all'
  | 'new'
  | 'in_progress'
  | 'closed'
  | 'critical_high'

export type DriverReportsQuery = {
  search?: string
  status?: DriverReportStatusFilter
  reportType?: DriverReportTypeFilter
  priority?: DriverReportPriorityFilter
  workerId?: string | 'all'
  vehicleId?: string | 'all'
  dateFrom?: string
  dateTo?: string
  kpiFilter?: DriverReportKpiFilter
}

export type DriverReportSummaryStats = {
  newReports: number
  inProgress: number
  closed: number
  criticalHigh: number
}

export type CreateDriverReportInput = {
  title: string
  reportType: string
  workerId?: string | null
  vehicleId?: string | null
  priority?: DriverReportPriority
  status?: DriverReportStatus
  description?: string | null
  location?: string | null
  issueDatetime?: string | null
  officeNotes?: string | null
  attachmentUrl?: string | null
  attachmentPath?: string | null
}

export type UpdateDriverReportInput = Partial<CreateDriverReportInput>

export type DriverReportFormValues = {
  title: string
  reportType: string
  workerId: string
  vehicleId: string
  priority: DriverReportPriority
  status: DriverReportStatus
  description: string
  location: string
  issueDatetime: string
  officeNotes: string
}

export type DriverReportFormSubmitPayload = {
  values: DriverReportFormValues
  file: File | null
  removeFile: boolean
}

export const DEFAULT_DRIVER_REPORT_PAGE_SIZE = 25
export const DRIVER_REPORT_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
