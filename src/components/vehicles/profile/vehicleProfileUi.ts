export const vehicleProfilePanelClass =
  'rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/98 to-[#EEF6FF]/92 shadow-[0_4px_16px_rgba(33,142,231,0.06)] ring-1 ring-[#C5DFFB]/35'

export const vehicleProfileTableHeadClass =
  'border-b border-[#D3E9FC]/70 bg-[#F5FAFF]/90 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0B68BE]'

export const vehicleProfileTableRowClass =
  'border-b border-[#D3E9FC]/45 transition-colors last:border-b-0 hover:bg-[#F5FAFF]/80'

export const vehicleProfileFieldLabelClass =
  'text-[10px] font-bold uppercase tracking-[0.08em] text-[#5499BF]'

export const vehicleProfileFieldValueClass = 'mt-1 text-sm font-semibold text-[#113C69]'

export type VehicleProfileTabId =
  | 'overview'
  | 'vehicle-checks'
  | 'consumables'
  | 'documents'
  | 'driver-reports'
  | 'availability'

export const VEHICLE_PROFILE_TABS: Array<{ id: VehicleProfileTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'vehicle-checks', label: 'Vehicle Checks' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'documents', label: 'Documents' },
  { id: 'driver-reports', label: 'Driver Reports' },
  { id: 'availability', label: 'Availability / History' },
]

export const vehicleProfileTabFromSearchParam: Record<string, VehicleProfileTabId> = {
  overview: 'overview',
  consumables: 'consumables',
  documents: 'documents',
  checks: 'vehicle-checks',
  'vehicle-checks': 'vehicle-checks',
  reports: 'driver-reports',
  'driver-reports': 'driver-reports',
  availability: 'availability',
}
