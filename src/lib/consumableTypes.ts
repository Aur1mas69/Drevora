export const CONSUMABLE_TYPES = [
  'Diesel',
  'Petrol',
  'AdBlue',
  'Engine Oil',
  'Coolant',
  'Screenwash',
  'Hydraulic Oil',
  'Grease',
  'Admixture',
  'Concrete Additive',
  'Other',
] as const

export type ConsumableType = (typeof CONSUMABLE_TYPES)[number]

export const CONSUMABLE_UNITS = ['L', 'ml', 'kg', 'pcs', 'other'] as const

export type ConsumableUnit = (typeof CONSUMABLE_UNITS)[number]

export type Consumable = {
  id: string
  createdAt: string
  updatedAt: string
  vehicleId: string | null
  vehicleLabel: string | null
  workerId: string | null
  workerName: string | null
  consumableType: ConsumableType
  itemName: string | null
  quantity: number
  unit: ConsumableUnit
  cost: number | null
  supplier: string | null
  site: string | null
  odometer: number | null
  receiptUrl: string | null
  notes: string | null
  entryDate: string
  entryTime: string | null
}

export type ConsumableTypeFilter = ConsumableType | 'all'

export type ConsumablesQuery = {
  search?: string
  type?: ConsumableTypeFilter
  vehicleId?: string | 'all'
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type ConsumablesPageResult = {
  items: Consumable[]
  totalCount: number
  page: number
  pageSize: number
}

export type CreateConsumableInput = {
  entryDate: string
  vehicleId: string
  consumableType: ConsumableType
  quantity: number
  unit: ConsumableUnit
  entryTime?: string | null
  workerId?: string | null
  itemName?: string | null
  cost?: number | null
  supplier?: string | null
  site?: string | null
  odometer?: number | null
  receiptUrl?: string | null
  notes?: string | null
}

export type UpdateConsumableInput = Partial<CreateConsumableInput>

export const CONSUMABLE_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_CONSUMABLE_PAGE_SIZE = 25

export type ConsumableFormValues = {
  entryDate: string
  entryTime: string
  vehicleId: string
  workerId: string
  consumableType: ConsumableType
  itemName: string
  quantity: string
  unit: ConsumableUnit
  cost: string
  supplier: string
  site: string
  odometer: string
  notes: string
}

export type ConsumableFormSubmitPayload = {
  values: ConsumableFormValues
  receiptFile: File | null
  removeReceipt: boolean
}

export type ConsumablesMonthlySummaryQuery = {
  year: number
  month: number
  vehicleId?: string | 'all'
  type?: ConsumableTypeFilter
}

export type ConsumableSummaryRecord = {
  consumableType: ConsumableType
  unit: ConsumableUnit
  quantity: number
  cost: number | null
  vehicleId: string | null
  entryDate: string
}

export type ConsumableMonthlyTypeSummary = {
  key: string
  consumableType: ConsumableType
  unit: ConsumableUnit
  totalQuantity: number
  totalCost: number | null
  entryCount: number
  vehiclesUsed: number
  lastEntryDate: string | null
}

export type ConsumableMonthlyVehicleBreakdown = {
  vehicleId: string | null
  vehicleLabel: string | null
  totalQuantity: number
  totalCost: number | null
  entryCount: number
  lastEntryDate: string | null
}

export type ConsumablesMonthlySummaryResult = {
  records: ConsumableSummaryRecord[]
  vehicleLabels: Record<string, string>
}
