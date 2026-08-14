/**
 * Admin Dashboard card layout preferences (order + visibility).
 *
 * Storage is localStorage for MVP. read/write are isolated so a later
 * per-user server preference API can replace them without changing the grid.
 */

export const ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY = 'drevora.adminDashboard.layout.v1'

export const ADMIN_DASHBOARD_LAYOUT_VERSION = 1 as const

export const ADMIN_DASHBOARD_SORTABLE_CARD_IDS = [
  'timesheet',
  'holidays',
  'driverReports',
  'fleetStatus',
  'fleetCompliance',
  'dailyVehicleChecks',
  'consumables',
  'trailers',
  'tyreChecks',
] as const

export const ADMIN_DASHBOARD_PINNED_CARD_IDS = ['notesPlans', 'recentActivity'] as const

export type AdminDashboardSortableCardId =
  (typeof ADMIN_DASHBOARD_SORTABLE_CARD_IDS)[number]

export type AdminDashboardPinnedCardId =
  (typeof ADMIN_DASHBOARD_PINNED_CARD_IDS)[number]

export type AdminDashboardCardId =
  | AdminDashboardSortableCardId
  | AdminDashboardPinnedCardId

export type AdminDashboardLayoutV1 = {
  version: typeof ADMIN_DASHBOARD_LAYOUT_VERSION
  order: AdminDashboardSortableCardId[]
  hidden: AdminDashboardCardId[]
}

export const ADMIN_DASHBOARD_CARD_LABELS: Record<AdminDashboardCardId, string> = {
  timesheet: 'Timesheet Overview',
  holidays: 'Holiday Requests',
  driverReports: 'Driver Reports',
  fleetStatus: 'Fleet Status',
  fleetCompliance: 'Fleet Compliance Alerts',
  dailyVehicleChecks: 'Daily Vehicle Checks Stats',
  consumables: 'Total Consumables',
  trailers: 'Trailers',
  tyreChecks: 'Tyre Checks',
  notesPlans: 'Notes / Plans',
  recentActivity: 'Recent Activity',
}

export const DEFAULT_ADMIN_DASHBOARD_LAYOUT: AdminDashboardLayoutV1 = {
  version: ADMIN_DASHBOARD_LAYOUT_VERSION,
  order: [...ADMIN_DASHBOARD_SORTABLE_CARD_IDS],
  hidden: [],
}

const SORTABLE_ID_SET = new Set<string>(ADMIN_DASHBOARD_SORTABLE_CARD_IDS)
const ALL_ID_SET = new Set<string>([
  ...ADMIN_DASHBOARD_SORTABLE_CARD_IDS,
  ...ADMIN_DASHBOARD_PINNED_CARD_IDS,
])

function isSortableCardId(value: string): value is AdminDashboardSortableCardId {
  return SORTABLE_ID_SET.has(value)
}

function isCardId(value: string): value is AdminDashboardCardId {
  return ALL_ID_SET.has(value)
}

function uniqueIds<T extends string>(ids: T[]): T[] {
  const seen = new Set<T>()
  const result: T[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

export function normalizeAdminDashboardOrder(
  stored: unknown,
): AdminDashboardSortableCardId[] {
  const fromStorage = Array.isArray(stored)
    ? stored.filter((value): value is AdminDashboardSortableCardId =>
        typeof value === 'string' && isSortableCardId(value),
      )
    : []

  const order = uniqueIds(fromStorage)
  const seen = new Set(order)

  for (const id of ADMIN_DASHBOARD_SORTABLE_CARD_IDS) {
    if (!seen.has(id)) order.push(id)
  }

  return order
}

export function normalizeAdminDashboardHidden(stored: unknown): AdminDashboardCardId[] {
  if (!Array.isArray(stored)) return []

  return uniqueIds(
    stored.filter(
      (value): value is AdminDashboardCardId =>
        typeof value === 'string' && isCardId(value),
    ),
  )
}

export function parseAdminDashboardLayout(raw: unknown): AdminDashboardLayoutV1 {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT, order: [...DEFAULT_ADMIN_DASHBOARD_LAYOUT.order] }
  }

  const record = raw as { version?: unknown; order?: unknown; hidden?: unknown }
  if (record.version !== ADMIN_DASHBOARD_LAYOUT_VERSION) {
    return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT, order: [...DEFAULT_ADMIN_DASHBOARD_LAYOUT.order] }
  }

  return {
    version: ADMIN_DASHBOARD_LAYOUT_VERSION,
    order: normalizeAdminDashboardOrder(record.order),
    hidden: normalizeAdminDashboardHidden(record.hidden),
  }
}

export function readAdminDashboardLayout(): AdminDashboardLayoutV1 {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT, order: [...DEFAULT_ADMIN_DASHBOARD_LAYOUT.order] }
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT, order: [...DEFAULT_ADMIN_DASHBOARD_LAYOUT.order] }
    }
    return parseAdminDashboardLayout(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_ADMIN_DASHBOARD_LAYOUT, order: [...DEFAULT_ADMIN_DASHBOARD_LAYOUT.order] }
  }
}

export function writeAdminDashboardLayout(layout: AdminDashboardLayoutV1): void {
  if (typeof window === 'undefined') return

  try {
    const normalized: AdminDashboardLayoutV1 = {
      version: ADMIN_DASHBOARD_LAYOUT_VERSION,
      order: normalizeAdminDashboardOrder(layout.order),
      hidden: normalizeAdminDashboardHidden(layout.hidden),
    }
    window.localStorage.setItem(
      ADMIN_DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalized),
    )
  } catch {
    // Ignore quota / private-mode failures; in-memory state still works.
  }
}

export function isAdminDashboardCardHidden(
  layout: AdminDashboardLayoutV1,
  id: AdminDashboardCardId,
): boolean {
  return layout.hidden.includes(id)
}

export function visibleSortableCardIds(
  layout: AdminDashboardLayoutV1,
): AdminDashboardSortableCardId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id))
}

export function moveSortableCard(
  order: AdminDashboardSortableCardId[],
  fromId: AdminDashboardSortableCardId,
  toId: AdminDashboardSortableCardId,
): AdminDashboardSortableCardId[] {
  if (fromId === toId) return order
  const next = [...order]
  const fromIndex = next.indexOf(fromId)
  const toIndex = next.indexOf(toId)
  if (fromIndex < 0 || toIndex < 0) return order
  next.splice(fromIndex, 1)
  next.splice(toIndex, 0, fromId)
  return next
}
