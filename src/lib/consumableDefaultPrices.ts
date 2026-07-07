import type { ConsumableType, ConsumableUnit } from '@/lib/consumableTypes'
import { CONSUMABLE_TYPES, CONSUMABLE_UNITS, normalizeConsumableTypeKey } from '@/lib/consumableTypes'
import { DEFAULT_CURRENCY, type CompanyCurrency } from '@/lib/companySettingsTypes'
import { formatBonusAmount } from '@/lib/timesheetUtils'

export type ConsumableDefaultPrice = {
  unitPrice: number
  unit: ConsumableUnit
}

export type ConsumableDefaultPricesMap = Partial<Record<ConsumableType, ConsumableDefaultPrice>>

/** Types available in default-price settings (excludes Petrol). */
export const CONSUMABLE_DEFAULT_PRICE_TYPES: ConsumableType[] = [
  'Diesel',
  'AdBlue',
  'Engine Oil',
  'Coolant',
  'Screenwash',
  'Hydraulic Oil',
  'Grease',
  'Admixture',
  'Concrete Additive',
  'Other',
]

export function getDefaultPriceUnitForType(type: ConsumableType): ConsumableUnit {
  if (type === 'Grease') return 'pcs'
  if (
    type === 'Diesel' ||
    type === 'Petrol' ||
    type === 'AdBlue' ||
    type === 'Engine Oil' ||
    type === 'Coolant' ||
    type === 'Screenwash' ||
    type === 'Hydraulic Oil' ||
    type === 'Admixture' ||
    type === 'Concrete Additive'
  ) {
    return 'L'
  }
  return 'L'
}

function isConsumableUnit(value: unknown): value is ConsumableUnit {
  return typeof value === 'string' && CONSUMABLE_UNITS.includes(value as ConsumableUnit)
}

function readUnitPrice(value: Record<string, unknown>): number {
  const raw = value.unitPrice ?? value.unit_price ?? value.price
  return Number(raw)
}

function normalizePriceEntry(
  type: ConsumableType,
  value: unknown,
): ConsumableDefaultPrice | null {
  if (typeof value !== 'object' || value === null) return null

  const source = value as Record<string, unknown>
  const unitPrice = readUnitPrice(source)
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null

  let unit = isConsumableUnit(source.unit) ? source.unit : getDefaultPriceUnitForType(type)
  if (type === 'Grease' && unit === 'kg') {
    unit = 'pcs'
  }

  return { unitPrice, unit }
}

export function normalizeConsumableDefaultPrices(value: unknown): ConsumableDefaultPricesMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const source = value as Record<string, unknown>
  const result: ConsumableDefaultPricesMap = {}

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const type = normalizeConsumableTypeKey(rawKey)
    if (!type) continue

    const entry = normalizePriceEntry(type, rawValue)
    if (entry) {
      result[type] = entry
    }
  }

  for (const type of CONSUMABLE_TYPES) {
    if (result[type]) continue
    const entry = normalizePriceEntry(type, source[type])
    if (entry) {
      result[type] = entry
    }
  }

  return result
}

export function serializeConsumableDefaultPrices(
  prices: ConsumableDefaultPricesMap,
): Record<string, ConsumableDefaultPrice> {
  const result: Record<string, ConsumableDefaultPrice> = {}

  for (const [type, entry] of Object.entries(prices) as Array<
    [ConsumableType, ConsumableDefaultPrice | undefined]
  >) {
    if (!entry || !Number.isFinite(entry.unitPrice) || entry.unitPrice < 0) continue
    result[type] = {
      unitPrice: entry.unitPrice,
      unit: entry.unit,
    }
  }

  return result
}

export function resolveDefaultUnitPrice(
  prices: ConsumableDefaultPricesMap | undefined,
  type: ConsumableType | string,
): ConsumableDefaultPrice | null {
  if (!prices) return null

  const canonicalType = normalizeConsumableTypeKey(type) ?? (type as ConsumableType)
  if (prices[canonicalType]) {
    return prices[canonicalType] ?? null
  }

  for (const [rawKey, entry] of Object.entries(prices) as Array<
    [ConsumableType, ConsumableDefaultPrice | undefined]
  >) {
    if (!entry) continue
    if (normalizeConsumableTypeKey(rawKey) === canonicalType) {
      return entry
    }
  }

  return null
}

export function hasConfiguredConsumableDefaultPrices(
  prices: ConsumableDefaultPricesMap | undefined,
): boolean {
  if (!prices) return false
  return Object.keys(prices).length > 0
}

export function listConfiguredDefaultPrices(
  prices: ConsumableDefaultPricesMap | undefined,
): Array<{ type: ConsumableType; entry: ConsumableDefaultPrice }> {
  if (!prices) return []

  return (Object.entries(prices) as Array<[ConsumableType, ConsumableDefaultPrice | undefined]>)
    .filter(([, entry]) => entry && Number.isFinite(entry.unitPrice) && entry.unitPrice >= 0)
    .map(([type, entry]) => ({
      type: normalizeConsumableTypeKey(type) ?? type,
      entry: entry!,
    }))
    .sort((left, right) => left.type.localeCompare(right.type))
}

export function formatConfiguredDefaultPriceLine(
  type: ConsumableType,
  entry: ConsumableDefaultPrice,
  currency: CompanyCurrency = DEFAULT_CURRENCY,
): string {
  return `${type} — ${formatBonusAmount(entry.unitPrice, currency)} / ${entry.unit}`
}

function hasPositiveCost(cost: number | null | undefined): cost is number {
  return cost !== null && cost !== undefined && Number.isFinite(cost) && cost > 0
}

export function resolveConsumableDisplayCost(input: {
  consumableType: ConsumableType | string
  quantity: number
  cost: number | null | undefined
  unitPrice?: number | null
  defaultPrices?: ConsumableDefaultPricesMap
}): number | null {
  const { quantity, cost, unitPrice, defaultPrices } = input
  const consumableType = normalizeConsumableTypeKey(String(input.consumableType)) ?? 'Other'

  if (hasPositiveCost(cost)) {
    return cost
  }

  if (unitPrice !== null && unitPrice !== undefined && Number.isFinite(unitPrice) && unitPrice >= 0) {
    const fromUnitPrice = calculateConsumableTotalCost(quantity, unitPrice)
    if (fromUnitPrice !== null && fromUnitPrice > 0) {
      return fromUnitPrice
    }
  }

  return resolveConsumableEntryCost(consumableType, quantity, defaultPrices)
}

export function resolveConsumableEntryCost(
  consumableType: ConsumableType | string,
  quantity: number,
  defaultPrices: ConsumableDefaultPricesMap | undefined,
): number | null {
  const canonicalType = normalizeConsumableTypeKey(String(consumableType)) ?? 'Other'
  const defaultPrice = resolveDefaultUnitPrice(defaultPrices, canonicalType)
  if (!defaultPrice) return null

  const total = calculateConsumableTotalCost(quantity, defaultPrice.unitPrice)
  return total !== null && total > 0 ? total : null
}

export function calculateConsumableTotalCost(
  quantity: number,
  unitPrice: number,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return null
  return Math.round(quantity * unitPrice * 100) / 100
}

export function formatCalculatedCost(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

export function deriveUnitPriceFromTotal(
  quantity: number,
  totalCost: number | null,
): string {
  if (totalCost === null || !Number.isFinite(quantity) || quantity <= 0) return ''
  const unitPrice = totalCost / quantity
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return ''
  return formatCalculatedCost(unitPrice)
}
