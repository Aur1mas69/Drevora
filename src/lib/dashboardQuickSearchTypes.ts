export type QuickSearchModule =
  | 'Workers'
  | 'Vehicles'
  | 'Timesheets'
  | 'Holiday Requests'
  | 'Vehicle Checks'
  | 'Driver Reports'
  | 'Documents'
  | 'Contacts'
  | 'Consumables'

export type QuickSearchResultItem = {
  id: string
  module: QuickSearchModule
  title: string
  subtitle: string
  path: string
}

export type QuickSearchGroupedResults = {
  workers: QuickSearchResultItem[]
  vehicles: QuickSearchResultItem[]
  timesheets: QuickSearchResultItem[]
  holidayRequests: QuickSearchResultItem[]
  vehicleChecks: QuickSearchResultItem[]
  driverReports: QuickSearchResultItem[]
  documents: QuickSearchResultItem[]
  contacts: QuickSearchResultItem[]
  consumables: QuickSearchResultItem[]
}

export const emptyQuickSearchResults: QuickSearchGroupedResults = {
  workers: [],
  vehicles: [],
  timesheets: [],
  holidayRequests: [],
  vehicleChecks: [],
  driverReports: [],
  documents: [],
  contacts: [],
  consumables: [],
}

export const QUICK_SEARCH_MIN_LENGTH = 2
export const QUICK_SEARCH_RESULTS_PER_MODULE = 5
