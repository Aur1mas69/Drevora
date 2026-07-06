export type QuickSearchModule =
  | 'Workers'
  | 'Vehicles'
  | 'Driver Reports'
  | 'Documents'
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
  driverReports: QuickSearchResultItem[]
  documents: QuickSearchResultItem[]
  consumables: QuickSearchResultItem[]
}

export const emptyQuickSearchResults: QuickSearchGroupedResults = {
  workers: [],
  vehicles: [],
  driverReports: [],
  documents: [],
  consumables: [],
}

export const QUICK_SEARCH_MIN_LENGTH = 2
export const QUICK_SEARCH_RESULTS_PER_MODULE = 5
