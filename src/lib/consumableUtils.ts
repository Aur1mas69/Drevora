import type {
  ConsumableMonthlyTypeSummary,
  ConsumableMonthlyVehicleBreakdown,
  ConsumableSummaryRecord,
  ConsumableType,
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
