import type {
  ConsumableMonthlyTypeSummary,
  ConsumableMonthlyVehicleBreakdown,
  ConsumableSummaryRecord,
  ConsumableSummaryPeriod,
  ConsumableType,
  ConsumableTypeCardSummary,
  ConsumableTypeQuantityLine,
  ConsumableTypeVehicleBreakdown,
  ConsumableUnit,
} from '@/lib/consumableTypes'
import { CONSUMABLE_TYPES, CONSUMABLE_UNITS } from '@/lib/consumableTypes'
import { DEFAULT_CURRENCY, type CompanyCurrency } from '@/lib/companySettingsTypes'
import { getSetting } from '@/lib/companySettingsGlobals'
import { formatBonusAmount } from '@/lib/timesheetUtils'

const LITRE_DEFAULT_TYPES: ConsumableType[] = [
  'Diesel',
  'Petrol',
  'AdBlue',
  'Engine Oil',
  'Coolant',
  'Screenwash',
  'Hydraulic Oil',
  'Admixture',
  'Concrete Additive',
]

export function isConsumableType(value: string | null | undefined): value is ConsumableType {
  return CONSUMABLE_TYPES.includes(value as ConsumableType)
}

export function isConsumableUnit(value: string | null | undefined): value is ConsumableUnit {
  return CONSUMABLE_UNITS.includes(value as ConsumableUnit)
}

export function getDefaultUnitForType(type: ConsumableType): ConsumableUnit {
  if (type === 'Grease') return 'kg'
  if (LITRE_DEFAULT_TYPES.includes(type)) return 'L'
  return 'L'
}

export function formatQuantityWithUnit(quantity: number, unit: ConsumableUnit): string {
  const formatted = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/\.?0+$/, '')
  return `${formatted} ${unit}`
}

export function formatConsumableCost(
  cost: number | null | undefined,
  currency: CompanyCurrency = getSetting('currency') ?? DEFAULT_CURRENCY,
): string {
  if (cost === null || cost === undefined || Number.isNaN(cost)) return '—'
  return formatBonusAmount(cost, currency)
}

export function formatSupplierSite(supplier: string | null, site: string | null): string {
  const parts = [supplier?.trim(), site?.trim()].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function getConsumableTypeBadgeClass(type: ConsumableType): string {
  switch (type) {
    case 'AdBlue':
      return 'bg-[#E8F3FE] text-[#0B68BE] border-[#BFE3F5]'
    case 'Diesel':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'Petrol':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'Engine Oil':
    case 'Hydraulic Oil':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Coolant':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'Screenwash':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'Grease':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'Admixture':
    case 'Concrete Additive':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export function hasReceiptAttached(receiptUrl: string | null | undefined): boolean {
  return Boolean(receiptUrl?.trim())
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateConsumableForm(input: {
  entryDate: string
  vehicleId: string
  consumableType: ConsumableType
  quantity: string
  unit: ConsumableUnit
  cost: string
  odometer: string
}): string | null {
  if (!input.entryDate.trim()) return 'Date is required.'
  if (!input.vehicleId.trim()) return 'Vehicle is required.'
  if (!input.consumableType) return 'Type is required.'
  if (!input.unit) return 'Unit is required.'

  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity < 0) return 'Quantity must be zero or greater.'

  const cost = parseOptionalNumber(input.cost)
  if (input.cost.trim() && (cost === null || cost < 0)) {
    return 'Cost must be zero or greater.'
  }

  const odometer = parseOptionalNumber(input.odometer)
  if (input.odometer.trim() && (odometer === null || odometer < 0)) {
    return 'Odometer must be zero or greater.'
  }

  return null
}

const OTHER_FLUID_TYPES: ConsumableType[] = [
  'Petrol',
  'Engine Oil',
  'Coolant',
  'Screenwash',
  'Hydraulic Oil',
  'Admixture',
  'Concrete Additive',
  'Other',
]

export type VehicleConsumableSummary = {
  dieselTotal: number
  adBlueTotal: number
  otherFluidsTotal: number
}

function quantityToLitres(quantity: number, unit: ConsumableUnit): number {
  if (unit === 'ml') return quantity / 1000
  if (unit === 'L') return quantity
  return 0
}

export function computeVehicleConsumableSummaries(
  items: Array<{ consumableType: ConsumableType; quantity: number; unit: ConsumableUnit }>,
): VehicleConsumableSummary {
  let dieselTotal = 0
  let adBlueTotal = 0
  let otherFluidsTotal = 0

  for (const item of items) {
    const litres = quantityToLitres(item.quantity, item.unit)
    if (litres <= 0) continue

    if (item.consumableType === 'Diesel') {
      dieselTotal += litres
    } else if (item.consumableType === 'AdBlue') {
      adBlueTotal += litres
    } else if (OTHER_FLUID_TYPES.includes(item.consumableType)) {
      otherFluidsTotal += litres
    }
  }

  return { dieselTotal, adBlueTotal, otherFluidsTotal }
}

export function formatVehicleConsumableHistoryLine(input: {
  entryDateLabel: string
  consumableType: ConsumableType
  itemName: string | null
  quantity: number
  unit: ConsumableUnit
  costLabel: string
  supplierSite: string
}): string {
  const label = input.itemName?.trim() || input.consumableType
  const quantity = formatQuantityWithUnit(input.quantity, input.unit)
  const supplierPart =
    input.supplierSite !== '—' ? ` · ${input.supplierSite}` : ''

  return `${input.entryDateLabel} · ${label} · ${quantity} · ${input.costLabel}${supplierPart}`
}

export function filterConsumablesClientSide<T extends { itemName: string | null; supplier: string | null; site: string | null; vehicleLabel: string | null; workerName: string | null }>(
  items: T[],
  searchTerm: string,
): T[] {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return items

  return items.filter((item) => {
    const haystack = [
      item.itemName,
      item.supplier,
      item.site,
      item.vehicleLabel,
      item.workerName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function getMonthDateRange(year: number, month: number): { dateFrom: string; dateTo: string } {
  const paddedMonth = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const paddedLastDay = String(lastDay).padStart(2, '0')

  return {
    dateFrom: `${year}-${paddedMonth}-01`,
    dateTo: `${year}-${paddedMonth}-${paddedLastDay}`,
  }
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy
}

function endOfWeekSunday(date: Date): Date {
  const monday = startOfWeekMonday(date)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday
}

export function getConsumableSummaryDateRange(
  period: ConsumableSummaryPeriod,
  customFrom?: string,
  customTo?: string,
): { dateFrom?: string; dateTo?: string } {
  const now = new Date()

  switch (period) {
    case 'this_week':
      return {
        dateFrom: toIsoDate(startOfWeekMonday(now)),
        dateTo: toIsoDate(endOfWeekSunday(now)),
      }
    case 'this_month':
      return getMonthDateRange(now.getFullYear(), now.getMonth() + 1)
    case 'this_year':
      return {
        dateFrom: `${now.getFullYear()}-01-01`,
        dateTo: `${now.getFullYear()}-12-31`,
      }
    case 'all_time':
      return {}
    case 'custom': {
      const from = customFrom?.trim()
      const to = customTo?.trim()
      if (!from && !to) return getMonthDateRange(now.getFullYear(), now.getMonth() + 1)
      return {
        dateFrom: from || undefined,
        dateTo: to || undefined,
      }
    }
    default:
      return getMonthDateRange(now.getFullYear(), now.getMonth() + 1)
  }
}

export function getConsumableSummaryPeriodLabel(
  period: ConsumableSummaryPeriod,
  customFrom?: string,
  customTo?: string,
): string {
  switch (period) {
    case 'this_week':
      return 'This week'
    case 'this_month':
      return 'This month'
    case 'this_year':
      return 'This year'
    case 'all_time':
      return 'All time'
    case 'custom':
      if (customFrom && customTo) return `${customFrom} – ${customTo}`
      if (customFrom) return `From ${customFrom}`
      if (customTo) return `Until ${customTo}`
      return 'Custom range'
    default:
      return 'This month'
  }
}

export function formatTypeCardQuantity(lines: ConsumableTypeQuantityLine[]): string {
  if (lines.length === 0) return '—'
  return lines
    .map((line) => `${formatSummaryQuantity(line.totalQuantity)} ${line.unit}`)
    .join(' · ')
}

export function getConsumableTypeAccent(type: ConsumableType): {
  bar: string
  cardRing: string
  cardBg: string
} {
  switch (type) {
    case 'AdBlue':
      return {
        bar: 'bg-[#218EE7]',
        cardRing: 'ring-[#89CFF0]/60',
        cardBg: 'from-[#EEF6FF] to-[#D3E9FC]/50',
      }
    case 'Diesel':
      return {
        bar: 'bg-slate-600',
        cardRing: 'ring-slate-200/80',
        cardBg: 'from-slate-50 to-slate-100/80',
      }
    case 'Petrol':
      return {
        bar: 'bg-orange-500',
        cardRing: 'ring-orange-200/80',
        cardBg: 'from-orange-50 to-orange-100/60',
      }
    case 'Engine Oil':
    case 'Hydraulic Oil':
      return {
        bar: 'bg-amber-500',
        cardRing: 'ring-amber-200/80',
        cardBg: 'from-amber-50 to-amber-100/60',
      }
    case 'Coolant':
      return {
        bar: 'bg-red-400',
        cardRing: 'ring-red-200/80',
        cardBg: 'from-red-50 to-red-100/50',
      }
    case 'Screenwash':
      return {
        bar: 'bg-cyan-500',
        cardRing: 'ring-cyan-200/80',
        cardBg: 'from-cyan-50 to-cyan-100/50',
      }
    case 'Grease':
      return {
        bar: 'bg-yellow-500',
        cardRing: 'ring-yellow-200/80',
        cardBg: 'from-yellow-50 to-yellow-100/50',
      }
    case 'Admixture':
    case 'Concrete Additive':
      return {
        bar: 'bg-purple-500',
        cardRing: 'ring-purple-200/80',
        cardBg: 'from-purple-50 to-purple-100/50',
      }
    default:
      return {
        bar: 'bg-[#5499BF]',
        cardRing: 'ring-[#C5DFFB]/80',
        cardBg: 'from-[#F8FBFF] to-[#EEF6FF]',
      }
  }
}

function buildQuantityLines(rows: ConsumableSummaryRecord[]): ConsumableTypeQuantityLine[] {
  const unitGroups = new Map<ConsumableUnit, ConsumableSummaryRecord[]>()

  for (const row of rows) {
    const bucket = unitGroups.get(row.unit) ?? []
    bucket.push(row)
    unitGroups.set(row.unit, bucket)
  }

  return [...unitGroups.entries()]
    .map(([unit, unitRows]) => ({
      unit,
      totalQuantity: unitRows.reduce((sum, row) => sum + row.quantity, 0),
    }))
    .sort((left, right) => right.totalQuantity - left.totalQuantity)
}

export function computeConsumableTypeCards(
  records: ConsumableSummaryRecord[],
): ConsumableTypeCardSummary[] {
  const byType = new Map<ConsumableType, ConsumableSummaryRecord[]>()

  for (const record of records) {
    const bucket = byType.get(record.consumableType) ?? []
    bucket.push(record)
    byType.set(record.consumableType, bucket)
  }

  const cards = [...byType.entries()].map(([consumableType, rows]) => {
    const quantityLines = buildQuantityLines(rows)
    const primary = quantityLines[0] ?? { unit: 'L' as ConsumableUnit, totalQuantity: 0 }
    const vehicleIds = new Set(rows.map((row) => row.vehicleId).filter(Boolean))

    return {
      consumableType,
      quantityLines,
      totalCost: sumCosts(rows.map((row) => row.cost)),
      entryCount: rows.length,
      vehiclesUsed: vehicleIds.size,
      lastEntryDate: maxEntryDate(rows.map((row) => row.entryDate)),
      primaryQuantity: primary.totalQuantity,
      primaryUnit: primary.unit,
    }
  })

  return cards.sort((left, right) => right.primaryQuantity - left.primaryQuantity)
}

export function computeVehicleBreakdownForType(
  records: ConsumableSummaryRecord[],
  consumableType: ConsumableType,
  vehicleLabels: Map<string, string>,
): ConsumableTypeVehicleBreakdown[] {
  const filtered = records.filter((record) => record.consumableType === consumableType)
  const groups = new Map<string, ConsumableSummaryRecord[]>()

  for (const record of filtered) {
    const key = record.vehicleId ?? '__none__'
    const bucket = groups.get(key) ?? []
    bucket.push(record)
    groups.set(key, bucket)
  }

  const breakdown = [...groups.entries()].map(([key, rows]) => {
    const vehicleId = key === '__none__' ? null : key

    return {
      vehicleId,
      vehicleLabel: vehicleId ? vehicleLabels.get(vehicleId) ?? vehicleId : null,
      quantityLines: buildQuantityLines(rows),
      totalCost: sumCosts(rows.map((row) => row.cost)),
      entryCount: rows.length,
      lastEntryDate: maxEntryDate(rows.map((row) => row.entryDate)),
    }
  })

  return breakdown.sort((left, right) => {
    const leftQty = left.quantityLines[0]?.totalQuantity ?? 0
    const rightQty = right.quantityLines[0]?.totalQuantity ?? 0
    return rightQty - leftQty
  })
}

export function buildTypeUnitGroupKey(type: ConsumableType, unit: ConsumableUnit): string {
  return `${type}::${unit}`
}

export function formatSummaryQuantity(quantity: number): string {
  if (Number.isInteger(quantity)) {
    return quantity.toLocaleString('en-GB')
  }

  return quantity.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatEntryCount(count: number): string {
  return count === 1 ? '1 entry' : `${count.toLocaleString('en-GB')} entries`
}

export type ConsumablesMonthlySummaryStats = {
  totalEntries: number
  totalLitres: number
  totalCost: number | null
  vehiclesWithUsage: number
  typeSummaries: ConsumableMonthlyTypeSummary[]
}

function sumCosts(values: Array<number | null>): number | null {
  let total = 0
  let hasCost = false

  for (const value of values) {
    if (value === null || value === undefined || Number.isNaN(value)) continue
    total += value
    hasCost = true
  }

  return hasCost ? total : null
}

function maxEntryDate(dates: string[]): string | null {
  if (dates.length === 0) return null
  return dates.reduce((latest, current) => (current > latest ? current : latest))
}

export function computeVehicleBreakdownForTypeUnit(
  records: ConsumableSummaryRecord[],
  consumableType: ConsumableType,
  unit: ConsumableUnit,
  vehicleLabels: Map<string, string>,
): ConsumableMonthlyVehicleBreakdown[] {
  const filtered = records.filter(
    (record) => record.consumableType === consumableType && record.unit === unit,
  )

  const groups = new Map<string, ConsumableSummaryRecord[]>()

  for (const record of filtered) {
    const key = record.vehicleId ?? '__none__'
    const bucket = groups.get(key) ?? []
    bucket.push(record)
    groups.set(key, bucket)
  }

  const breakdown = [...groups.entries()].map(([key, rows]) => {
    const vehicleId = key === '__none__' ? null : key

    return {
      vehicleId,
      vehicleLabel: vehicleId ? vehicleLabels.get(vehicleId) ?? vehicleId : null,
      totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
      totalCost: sumCosts(rows.map((row) => row.cost)),
      entryCount: rows.length,
      lastEntryDate: maxEntryDate(rows.map((row) => row.entryDate)),
    }
  })

  return breakdown.sort((a, b) => b.totalQuantity - a.totalQuantity)
}

export function computeMonthlyConsumablesSummary(
  records: ConsumableSummaryRecord[],
): ConsumablesMonthlySummaryStats {
  const typeGroups = new Map<string, ConsumableSummaryRecord[]>()

  for (const record of records) {
    const key = buildTypeUnitGroupKey(record.consumableType, record.unit)
    const bucket = typeGroups.get(key) ?? []
    bucket.push(record)
    typeGroups.set(key, bucket)
  }

  const typeSummaries = [...typeGroups.entries()]
    .map(([key, rows]) => {
      const [consumableType, unit] = key.split('::') as [ConsumableType, ConsumableUnit]
      const vehicleIds = new Set(rows.map((row) => row.vehicleId).filter(Boolean))

      return {
        key,
        consumableType,
        unit,
        totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        totalCost: sumCosts(rows.map((row) => row.cost)),
        entryCount: rows.length,
        vehiclesUsed: vehicleIds.size,
        lastEntryDate: maxEntryDate(rows.map((row) => row.entryDate)),
      }
    })
    .sort((a, b) => b.totalQuantity - a.totalQuantity)

  const vehiclesWithUsage = new Set(records.map((row) => row.vehicleId).filter(Boolean)).size

  return {
    totalEntries: records.length,
    totalLitres: records
      .filter((row) => row.unit === 'L')
      .reduce((sum, row) => sum + row.quantity, 0),
    totalCost: sumCosts(records.map((row) => row.cost)),
    vehiclesWithUsage,
    typeSummaries,
  }
}
