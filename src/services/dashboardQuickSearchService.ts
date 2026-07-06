import {
  emptyQuickSearchResults,
  QUICK_SEARCH_RESULTS_PER_MODULE,
  type QuickSearchGroupedResults,
  type QuickSearchResultItem,
} from '@/lib/dashboardQuickSearchTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { fetchCompanySettings } from '@/services/companySettingsService'

type CompanySearchScope = {
  workerIds: Set<string> | null
}

type DriverNameJoinRow = {
  first_name: string
  last_name: string
}

type VehicleRegistrationJoinRow = {
  registration: string | null
}

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

function isWorkerInScope(
  workerId: string | null | undefined,
  scope: CompanySearchScope,
): boolean {
  if (!scope.workerIds) return true
  if (!workerId) return false
  return scope.workerIds.has(workerId)
}

async function fetchCompanySearchScope(): Promise<CompanySearchScope> {
  try {
    const settings = await fetchCompanySettings()
    const companyName = settings?.name?.trim() || null

    if (!companyName) {
      return { workerIds: null }
    }

    const { data, error } = await requireSupabase().from('drivers').select('id, company')

    if (error) {
      return { workerIds: null }
    }

    const workerIds = (data ?? [])
      .filter((row) => {
        const workerCompany = row.company?.trim() ?? ''
        return !workerCompany || workerCompany === companyName
      })
      .map((row) => row.id)

    return {
      workerIds: workerIds.length > 0 ? new Set(workerIds) : null,
    }
  } catch {
    return { workerIds: null }
  }
}

async function searchWorkers(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  let request = requireSupabase()
    .from('drivers')
    .select('id, first_name, last_name, email, phone, worker_code')
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},worker_code.ilike.${pattern}`,
    )
    .order('last_name', { ascending: true })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE)

  if (scope.workerIds) {
    request = request.in('id', [...scope.workerIds])
  }

  const { data, error } = await request

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchWorkers',
    table: 'drivers',
    data,
    error,
  })

  if (error) return []

  return (data ?? []).map((row) => {
    const name = `${row.first_name} ${row.last_name}`.trim() || 'Worker'
    const subtitle =
      row.worker_code?.trim() ||
      row.email?.trim() ||
      row.phone?.trim() ||
      'Worker record'

    return {
      id: row.id,
      module: 'Workers',
      title: name,
      subtitle,
      path: `/drivers/${row.id}`,
    }
  })
}

async function searchVehicles(pattern: string): Promise<QuickSearchResultItem[]> {
  const { data, error } = await requireSupabase()
    .from('vehicles')
    .select('id, registration, make, model')
    .or(`registration.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern}`)
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
    subtitle: [row.make, row.model].filter(Boolean).join(' ').trim() || 'Vehicle record',
    path: `/vehicles/${row.id}`,
  }))
}

async function searchDriverReports(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const { data, error } = await requireSupabase()
    .from('driver_reports')
    .select(
      'id, title, status, worker_id, driver_id, drivers ( first_name, last_name )',
    )
    .or(`title.ilike.${pattern},status.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2)

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchDriverReports',
    table: 'driver_reports',
    data,
    error,
  })

  if (error) return []

  const items: QuickSearchResultItem[] = []

  for (const row of data ?? []) {
    const workerId = row.worker_id ?? row.driver_id
    if (!isWorkerInScope(workerId, scope)) continue

    const workerName = formatWorkerName(
      normalizeJoinRow(row.drivers as DriverNameJoinRow | DriverNameJoinRow[] | null),
    )
    const title = row.title?.trim() || 'Driver Report'
    const status = row.status?.trim()

    items.push({
      id: row.id,
      module: 'Driver Reports',
      title,
      subtitle: status || workerName,
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
  const [workerDocsResult, vehicleDocsResult] = await Promise.all([
    requireSupabase()
      .from('worker_compliance_records')
      .select('id, worker_id, document_name, document_type, file_url')
      .or(
        `document_name.ilike.${pattern},document_type.ilike.${pattern},file_url.ilike.${pattern}`,
      )
      .order('updated_at', { ascending: false })
      .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2),
    requireSupabase()
      .from('vehicle_compliance_records')
      .select('id, vehicle_id, document_name, document_type, file_url')
      .or(
        `document_name.ilike.${pattern},document_type.ilike.${pattern},file_url.ilike.${pattern}`,
      )
      .order('updated_at', { ascending: false })
      .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2),
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

  const items: QuickSearchResultItem[] = []

  if (!workerDocsResult.error) {
    for (const row of workerDocsResult.data ?? []) {
      if (!isWorkerInScope(row.worker_id, scope)) continue

      const documentName =
        row.document_name?.trim() || row.document_type?.trim() || 'Document'
      const fileName = fileNameFromUrl(row.file_url)

      items.push({
        id: `worker-doc-${row.id}`,
        module: 'Documents',
        title: documentName,
        subtitle: fileName || row.document_type?.trim() || 'Worker document',
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
      const fileName = fileNameFromUrl(row.file_url)

      items.push({
        id: `vehicle-doc-${row.id}`,
        module: 'Documents',
        title: documentName,
        subtitle: fileName || row.document_type?.trim() || 'Vehicle document',
        path: row.vehicle_id
          ? `/compliance/vehicles/${row.vehicle_id}?tab=documents`
          : '/documents',
      })

      if (items.length >= QUICK_SEARCH_RESULTS_PER_MODULE) break
    }
  }

  return items
}

async function searchConsumables(
  pattern: string,
  scope: CompanySearchScope,
): Promise<QuickSearchResultItem[]> {
  const baseSelect =
    'id, consumable_type, item_name, supplier, site, worker_id, vehicle_id, vehicles ( registration )'

  const [textResult, vehicleMatches] = await Promise.all([
    requireSupabase()
      .from('consumables')
      .select(baseSelect)
      .is('deleted_at', null)
      .or(
        `consumable_type.ilike.${pattern},item_name.ilike.${pattern},supplier.ilike.${pattern},site.ilike.${pattern}`,
      )
      .order('entry_date', { ascending: false })
      .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2),
    requireSupabase()
      .from('vehicles')
      .select('id')
      .ilike('registration', pattern)
      .limit(10),
  ])

  let vehicleConsumables: typeof textResult.data = []

  const vehicleIds = (vehicleMatches.data ?? []).map((row) => row.id)
  if (vehicleIds.length > 0) {
    const { data } = await requireSupabase()
      .from('consumables')
      .select(baseSelect)
      .is('deleted_at', null)
      .in('vehicle_id', vehicleIds)
      .order('entry_date', { ascending: false })
      .limit(QUICK_SEARCH_RESULTS_PER_MODULE * 2)

    vehicleConsumables = data ?? []
  }

  logSupabaseQuery({
    service: 'dashboardQuickSearchService.searchConsumables',
    table: 'consumables',
    data: [...(textResult.data ?? []), ...vehicleConsumables],
    error: textResult.error,
  })

  if (textResult.error && vehicleConsumables.length === 0) return []

  const merged = new Map<string, NonNullable<typeof textResult.data>[number]>()
  for (const row of [...(textResult.data ?? []), ...vehicleConsumables]) {
    merged.set(row.id, row)
  }

  const items: QuickSearchResultItem[] = []

  for (const row of merged.values()) {
    if (row.worker_id && !isWorkerInScope(row.worker_id, scope)) continue

    const vehicle = normalizeJoinRow(
      row.vehicles as VehicleRegistrationJoinRow | VehicleRegistrationJoinRow[] | null,
    )
    const registration = vehicle?.registration?.trim()
    const supplierSite = [row.supplier?.trim(), row.site?.trim()].filter(Boolean).join(' · ')
    const title = row.item_name?.trim() || row.consumable_type?.trim() || 'Consumable'
    const subtitle =
      [registration, supplierSite].filter(Boolean).join(' · ') ||
      row.consumable_type ||
      'Consumable record'

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

  const [workers, vehicles, driverReports, documents, consumables] = await Promise.all([
    searchWorkers(pattern, scope),
    searchVehicles(pattern),
    searchDriverReports(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchDocuments(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
    searchConsumables(pattern, scope).catch(() => [] as QuickSearchResultItem[]),
  ])

  return {
    workers,
    vehicles,
    driverReports,
    documents,
    consumables,
  }
}

export const dashboardQuickSearchService = {
  searchDashboardQuick,
}
