import {
  getTimesheetWeekSettings,
  requireVerifiedCompanyId,
} from '@/lib/companySettingsGlobals'
import {
  emptyQuickSearchResults,
  QUICK_SEARCH_RESULTS_PER_MODULE,
  type QuickSearchGroupedResults,
  type QuickSearchResultItem,
} from '@/lib/dashboardQuickSearchTypes'
import { formatTimesheetWeekDisplay } from '@/lib/timesheetWeekNumber'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { driversService, type Driver } from '@/services/driversService'

type CompanySearchScope = {
  companyId: string
}

type DriverNameJoinRow = {
  first_name: string
  last_name: string
}

type VehicleRegistrationJoinRow = {
  registration: string | null
  fleet_number?: string | null
}

type VehicleCheckSearchRow = {
  id: string
  inspection_date: string
  status: string | null
  overall_result: string | null
  notes: string | null
  worker_id: string
  drivers: DriverNameJoinRow | DriverNameJoinRow[] | null
  vehicles: VehicleRegistrationJoinRow | VehicleRegistrationJoinRow[] | null
}

const vehicleCheckSearchSelect = `
  id,
  inspection_date,
  status,
  overall_result,
  notes,
  worker_id,
  drivers ( first_name, last_name ),
  vehicles ( registration, fleet_number )
`

function sanitizeSearchTerm(term: string): string {
  return term.trim().replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildIlikePattern(term: string): string {
  return `%${sanitizeSearchTerm(term)}%`
}

function normalizeJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatWorkerName(driver: DriverNameJoinRow | null): string {
  if (!driver) return 'Worker'
  const name = `${driver.first_name} ${driver.last_name}`.trim()
  return name || 'Worker'
}

function matchesVehicleCheckQuickSearch(row: VehicleCheckSearchRow, term: string): boolean {
  const driver = normalizeJoinRow(row.drivers)
  const vehicle = normalizeJoinRow(row.vehicles)
  const haystack = [
    vehicle?.registration,
    vehicle?.fleet_number,
    driver?.first_name,
    driver?.last_name,
    row.status,
    row.overall_result,
    row.notes,
    row.inspection_date,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(term.toLowerCase())
}

async function fetchCompanySearchScope(): Promise<CompanySearchScope> {
  return { companyId: requireVerifiedCompanyId() }
}

async function fetchMatchingWorkerIds(
  pattern: string,
  scope: CompanySearchScope,
): Promise<string[]> {
  const request = requireSupabase()
    .from('drivers')
    .select('id')
    .eq('company_id', scope.companyId)
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},worker_code.ilike.${pattern}`)

  const { data, error } = await request.limit(20)
  if (error) return []
  return (data ?? []).map((row) => row.id)
}

async function fetchMatchingVehicleIds(
  pattern: string,
  scope: CompanySearchScope,
): Promise<string[]> {
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id')
    .eq('company_id', scope.companyId)
    .or(`registration.ilike.${pattern},fleet_number.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`)
    .limit(20)

  if (error) return []
  return (data ?? []).map((row) => row.id)
}

function getWorkerDisplayName(driver: Driver): string {
  return `${driver.firstName} ${driver.lastName}`.trim() || 'Worker'
}

function matchesWorkerQuickSearch(driver: Driver, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  const displayName = getWorkerDisplayName(driver)

  return [
    driver.firstName,
    driver.lastName,
    displayName,
    driver.email,
    driver.phone ?? '',
    driver.workerCode ?? '',
  ].some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

async function searchWorkers(rawQuery: string): Promise<QuickSearchResultItem[]> {
  const term = sanitizeSearchTerm(rawQuery)
  if (term.length < 2) return []

  let drivers: Driver[]
  try {
    drivers = await driversService.fetchDrivers()
  } catch {
    return []
  }

  return drivers
    .filter((driver) => matchesWorkerQuickSearch(driver, term))
    .sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName)
      if (lastNameCompare !== 0) return lastNameCompare
      return a.firstName.localeCompare(b.firstName)
    })
    .slice(0, QUICK_SEARCH_RESULTS_PER_MODULE)
    .map((driver) => ({
      id: driver.id,
      module: 'Workers',
      title: getWorkerDisplayName(driver),
      subtitle:
        driver.workerCode?.trim() ||
        driver.email?.trim() ||
        driver.phone?.trim() ||
        'Worker record',
      path: `/drivers/${driver.id}`,
    }))
}

async function searchVehicles(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id, registration, fleet_number, make, model')
    .eq('company_id', scope.companyId)
    .or(
      `registration.ilike.${pattern},fleet_number.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`,
    )
    .order('registration', { ascending: true })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE)

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchVehicles',
    table: 'vehicles',
    data,
    error,
  })

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    module: 'Vehicles',
    title: row.registration?.trim() || 'Vehicle',
    subtitle:
      [row.fleet_number?.trim(), row.make, row.model].filter(Boolean).join(' · ').trim() ||
      'Vehicle record',
    path: `/vehicles/${row.id}`,
  }))
}

async function searchTimesheets(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const request = requireSupabase()
    .from('timesheets')
    .select('id, week_start, status, driver_id, drivers!inner ( first_name, last_name )')
    .eq('company_id', scope.companyId)
    .is('deleted_at', null)
    .or(
      `status.ilike.${pattern},week_start.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
      { referencedTable: 'drivers' },
    )
    .order('week_start', { ascending: false })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchTimesheets',
    table: 'timesheets',
    data,
    error,
  })

  if (error) return []

  const weekSettings = getTimesheetWeekSettings()

  return (data ?? []).map((row) => {
    const driver = normalizeJoinRow(row.drivers as DriverNameJoinRow | DriverNameJoinRow[] | null)
    const workerName = formatWorkerName(driver)
    const weekLabel = formatTimesheetWeekDisplay(row.week_start, weekSettings).weekTitle

    return {
      id: row.id,
      module: 'Timesheets',
      title: workerName,
      subtitle: [weekLabel, row.status?.trim()].filter(Boolean).join(' · ') || 'Timesheet',
      path: '/admin/timesheets',
    }
  })
}

async function searchHolidayRequests(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const request = requireSupabase()
    .from('holiday_requests')
    .select(
      'id, start_date, end_date, status, worker_id, drivers!inner ( first_name, last_name )',
    )
    .eq('company_id', scope.companyId)
    .or(
      `status.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`,
      { referencedTable: 'drivers' },
    )
    .order('start_date', { ascending: false })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchHolidayRequests',
    table: 'holiday_requests',
    data,
    error,
  })

  if (error) return []

  return (data ?? []).map((row) => {
    const driver = normalizeJoinRow(row.drivers as DriverNameJoinRow | DriverNameJoinRow[] | null)
    const workerName = formatWorkerName(driver)

    return {
      id: row.id,
      module: 'Holiday Requests',
      title: workerName,
      subtitle:
        [row.status?.trim(), `${row.start_date} – ${row.end_date}`].filter(Boolean).join(' · ') ||
        'Holiday request',
      path: '/admin/holidays',
    }
  })
}

async function searchVehicleChecks(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const request = requireSupabase()
    .from('vehicle_checks')
    .select(vehicleCheckSearchSelect)
    .eq('company_id', scope.companyId)
    .order('inspection_date', { ascending: false })
    .limit(40)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchVehicleChecks',
    table: 'vehicle_checks',
    data,
    error,
  })

  if (error) return []

  const term = sanitizeSearchTerm(pattern.replace(/^%|%$/g, ''))
  const items: QuickSearchResultItem[] = []

  for (const row of (data ?? []) as VehicleCheckSearchRow[]) {
    if (!matchesVehicleCheckQuickSearch(row, term)) continue

    const driver = normalizeJoinRow(row.drivers)
    const vehicle = normalizeJoinRow(row.vehicles)
    const registration = vehicle?.registration?.trim() || 'Vehicle'
    const workerName = formatWorkerName(driver)
    const result = row.overall_result?.trim() || row.status?.trim() || 'Check'

    items.push({
      id: row.id,
      module: 'Vehicle Checks',
      title: registration,
      subtitle: [workerName, result, row.inspection_date].filter(Boolean).join(' · '),
      path: '/admin/vehicle-checks',
    })

    if (items.length >= QUICK_SEARCH_RESULTS_PER_MODULE) break
  }

  return items
}

async function searchDriverReports(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const [workerIds, vehicleIds] = await Promise.all([
    fetchMatchingWorkerIds(pattern, scope),
    fetchMatchingVehicleIds(pattern, scope),
  ])

  const orFilters = [
    `title.ilike.${pattern}`,
    `status.ilike.${pattern}`,
    `report_type.ilike.${pattern}`,
  ]

  for (const workerId of workerIds) {
    orFilters.push(`worker_id.eq.${workerId}`)
  }

  for (const vehicleId of vehicleIds) {
    orFilters.push(`vehicle_id.eq.${vehicleId}`)
  }

  const request = requireSupabase()
    .from('driver_reports')
    .select('id, title, status, report_type, worker_id, vehicle_id')
    .eq('company_id', scope.companyId)
    .or(orFilters.join(','))
    .order('updated_at', { ascending: false })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchDriverReports',
    table: 'driver_reports',
    data,
    error,
  })

  if (error) return []

  const scopedRows = data ?? []

  const reportWorkerIds = scopedRows
    .map((row) => row.worker_id)
    .filter((id): id is string => Boolean(id))
  const reportVehicleIds = scopedRows
    .map((row) => row.vehicle_id)
    .filter((id): id is string => Boolean(id))

  const [workerNameById, vehicleLabelById] = await Promise.all([
    (async () => {
      const map = new Map<string, string>()
      if (reportWorkerIds.length === 0) return map
      const { data: workerRows } = await requireSupabase()
        .from('drivers')
        .select('id, first_name, last_name')
        .eq('company_id', scope.companyId)
        .in('id', [...new Set(reportWorkerIds)])
      for (const worker of workerRows ?? []) {
        map.set(worker.id, formatWorkerName(worker as DriverNameJoinRow))
      }
      return map
    })(),
    (async () => {
      const map = new Map<string, string>()
      if (reportVehicleIds.length === 0) return map
      const { data: vehicleRows } = await requireSupabase()
        .from('vehicles')
        .select('id, registration, fleet_number')
        .eq('company_id', scope.companyId)
        .in('id', [...new Set(reportVehicleIds)])
      for (const vehicle of vehicleRows ?? []) {
        map.set(
          vehicle.id,
          [vehicle.registration, vehicle.fleet_number].filter(Boolean).join(' · '),
        )
      }
      return map
    })(),
  ])

  const items: QuickSearchResultItem[] = []

  for (const row of scopedRows) {
    const workerName = row.worker_id ? workerNameById.get(row.worker_id) ?? 'Worker' : null
    const vehicleLabel = row.vehicle_id ? vehicleLabelById.get(row.vehicle_id) ?? null : null
    const title = row.title?.trim() || 'Driver Report'

    items.push({
      id: row.id,
      module: 'Driver Reports',
      title,
      subtitle:
        [row.report_type?.trim(), row.status?.trim(), workerName, vehicleLabel]
          .filter(Boolean)
          .join(' · ') || 'Driver report',
      path: '/admin/driver-reports',
    })

    if (items.length >= QUICK_SEARCH_RESULTS_PER_MODULE) break
  }

  return items
}

function fileNameFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const segment = url.split('/').pop()?.split('?')[0]?.trim()
  return segment || null
}

async function searchDocuments(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const [companyWorkersResult, companyVehiclesResult] = await Promise.all([
    requireSupabase().from('drivers').select('id').eq('company_id', scope.companyId),
    requireSupabase().from('vehicles').select('id').eq('company_id', scope.companyId),
  ])
  const companyWorkerIds = (companyWorkersResult.data ?? []).map((row) => row.id)
  const companyVehicleIds = (companyVehiclesResult.data ?? []).map((row) => row.id)

  const [workerDocsResult, vehicleDocsResult] = await Promise.all([
    companyWorkerIds.length
      ? requireSupabase()
      .from('worker_compliance_records')
      .select('id, worker_id, document_name, document_type, file_url')
      .or(
        `document_name.ilike.${pattern},document_type.ilike.${pattern},file_url.ilike.${pattern}`,
      )
      .in('worker_id', companyWorkerIds)
      .order('updated_at', { ascending: false })
      .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2)
      : Promise.resolve({ data: [], error: null }),
    companyVehicleIds.length
      ? requireSupabase()
      .from('vehicle_compliance_records')
      .select('id, vehicle_id, document_name, document_type, file_url')
      .or(
        `document_name.ilike.${pattern},document_type.ilike.${pattern},file_url.ilike.${pattern}`,
      )
      .in('vehicle_id', companyVehicleIds)
      .order('updated_at', { ascending: false })
      .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2)
      : Promise.resolve({ data: [], error: null }),
  ])

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchDocuments.worker',
    table: 'worker_compliance_records',
    data: workerDocsResult.data,
    error: workerDocsResult.error,
  })

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchDocuments.vehicle',
    table: 'vehicle_compliance_records',
    data: vehicleDocsResult.data,
    error: vehicleDocsResult.error,
  })

  const workerIds = (workerDocsResult.data ?? [])
    .map((row) => row.worker_id)
    .filter((id): id is string => Boolean(id))
  const vehicleIds = (vehicleDocsResult.data ?? [])
    .map((row) => row.vehicle_id)
    .filter((id): id is string => Boolean(id))

  const [workerNameById, vehicleLabelById] = await Promise.all([
    (async () => {
      const map = new Map<string, string>()
      if (workerIds.length === 0) return map
      const { data } = await requireSupabase()
        .from('drivers')
        .select('id, first_name, last_name')
        .eq('company_id', scope.companyId)
        .in('id', [...new Set(workerIds)])
      for (const worker of data ?? []) {
        map.set(worker.id, formatWorkerName(worker as DriverNameJoinRow))
      }
      return map
    })(),
    (async () => {
      const map = new Map<string, string>()
      if (vehicleIds.length === 0) return map
      const { data } = await requireSupabase()
        .from('vehicles')
        .select('id, registration, fleet_number')
        .eq('company_id', scope.companyId)
        .in('id', [...new Set(vehicleIds)])
      for (const vehicle of data ?? []) {
        map.set(
          vehicle.id,
          [vehicle.registration, vehicle.fleet_number].filter(Boolean).join(' · '),
        )
      }
      return map
    })(),
  ])

  const items: QuickSearchResultItem[] = []

  if (!workerDocsResult.error) {
    for (const row of workerDocsResult.data ?? []) {
      const documentName =
        row.document_name?.trim() || row.document_type?.trim() || 'Document'
      const workerName = row.worker_id ? workerNameById.get(row.worker_id) : null
      const fileName = fileNameFromUrl(row.file_url)

      items.push({
        id: `worker-doc-${row.id}`,
        module: 'Documents',
        title: documentName,
        subtitle:
          [row.document_type?.trim(), workerName, fileName].filter(Boolean).join(' · ') ||
          'Worker document',
        path: row.worker_id
          ? `/compliance/workers/${row.worker_id}?tab=documents`
          : '/documents',
      })

      if (items.length >= QUICK_SEARCH_RESULTS_PER_MODULE) {
        return items
      }
    }
  }

  if (!vehicleDocsResult.error) {
    for (const row of vehicleDocsResult.data ?? []) {
      const documentName =
        row.document_name?.trim() || row.document_type?.trim() || 'Document'
      const vehicleLabel = row.vehicle_id ? vehicleLabelById.get(row.vehicle_id) : null
      const fileName = fileNameFromUrl(row.file_url)

      items.push({
        id: `vehicle-doc-${row.id}`,
        module: 'Documents',
        title: documentName,
        subtitle:
          [row.document_type?.trim(), vehicleLabel, fileName].filter(Boolean).join(' · ') ||
          'Vehicle document',
        path: row.vehicle_id
          ? `/compliance/vehicles/${row.vehicle_id}?tab=documents`
          : '/documents',
      })

      if (items.length >= QUICK_SEARCH_RESULTS_PER_MODULE) break
    }
  }

  return items
}

async function searchContacts(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const request = requireSupabase()
    .from('contacts')
    .select('id, name, organisation, email, phone, account_reference')
    .eq('company_id', scope.companyId)
    .or(
      `name.ilike.${pattern},organisation.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},account_reference.ilike.${pattern}`,
    )
    .order('name', { ascending: true })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE)

  const { data, error } = await request

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchContacts',
    table: 'contacts',
    data,
    error,
  })

  if (error) return []

  return (data ?? []).map((row) => {
    const title = row.name?.trim() || row.organisation?.trim() || 'Contact'

    return {
      id: row.id,
      module: 'Contacts',
      title,
      subtitle:
        [row.organisation?.trim(), row.email?.trim(), row.phone?.trim(), row.account_reference?.trim()]
          .filter(Boolean)
          .join(' · ') || 'Contact record',
      path: '/contacts',
    }
  })
}

async function searchConsumables(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const baseSelect =
    'id, consumable_type, item_name, supplier, site, notes, worker_id, vehicle_id, vehicles ( registration )'

  const workerIds = await fetchMatchingWorkerIds(pattern, scope)
  const vehicleIds = await fetchMatchingVehicleIds(pattern, scope)

  const orFilters = [
    `consumable_type.ilike.${pattern}`,
    `item_name.ilike.${pattern}`,
    `supplier.ilike.${pattern}`,
    `site.ilike.${pattern}`,
    `notes.ilike.${pattern}`,
  ]

  for (const workerId of workerIds) {
    orFilters.push(`worker_id.eq.${workerId}`)
  }

  for (const vehicleId of vehicleIds) {
    orFilters.push(`vehicle_id.eq.${vehicleId}`)
  }

  const { data, error } = await requireSupabase()
    .from('consumables')
    .select(baseSelect)
    .eq('company_id', scope.companyId)
    .is('deleted_at', null)
    .or(orFilters.join(','))
    .order('entry_date', { ascending: false })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2)

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchConsumables',
    table: 'consumables',
    data,
    error,
  })

  if (error) return []

  const workerNameById = new Map<string, string>()
  const uniqueWorkerIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.worker_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  if (uniqueWorkerIds.length > 0) {
    const { data: workerRows } = await requireSupabase()
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('company_id', scope.companyId)
      .in('id', uniqueWorkerIds)

    for (const worker of workerRows ?? []) {
      workerNameById.set(worker.id, formatWorkerName(worker as DriverNameJoinRow))
    }
  }

  const items: QuickSearchResultItem[] = []

  for (const row of data ?? []) {
    const vehicle = normalizeJoinRow(
      row.vehicles as VehicleRegistrationJoinRow | VehicleRegistrationJoinRow[] | null,
    )
    const registration = vehicle?.registration?.trim()
    const workerName = row.worker_id ? workerNameById.get(row.worker_id) : null
    const supplierSite = [row.supplier?.trim(), row.site?.trim()].filter(Boolean).join(' · ')
    const title = row.item_name?.trim() || row.consumable_type?.trim() || 'Consumable'
    const subtitle =
      [registration, workerName, supplierSite, row.notes?.trim()]
        .filter(Boolean)
        .join(' · ') || row.consumable_type || 'Consumable record'

    items.push({
      id: row.id,
      module: 'Consumables',
      title,
      subtitle,
      path: row.vehicle_id ? `/consumables?vehicle=${row.vehicle_id}` : '/consumables',
    })

    if (items.length >= QUICK_SEARCH_RESULTS_PER_MODULE) break
  }

  return items
}

export async function searchDashboardQuick(
  rawQuery: string,
): Promise<QuickSearchGroupedResults> {
  const query = sanitizeSearchTerm(rawQuery)
  if (query.length < 2) {
    return emptyQuickSearchResults
  }

  const pattern = buildIlikePattern(query)
  const scope = await fetchCompanySearchScope()

  const [
    workers,
    vehicles,
    timesheets,
    holidayRequests,
    vehicleChecks,
    driverReports,
    documents,
    contacts,
    consumables,
  ] = await Promise.all([
    searchWorkers(query),
    searchVehicles(pattern, scope),
    searchTimesheets(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchHolidayRequests(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchVehicleChecks(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchDriverReports(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchDocuments(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchContacts(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchConsumables(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
  ])

  return {
    workers,
    vehicles,
    timesheets,
    holidayRequests,
    vehicleChecks,
    driverReports,
    documents,
    contacts,
    consumables,
  }
}

export const dashboardQuickSearchService = {
  searchDashboardQuick,
}
