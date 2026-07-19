import { EXPORT_FETCH_PAGE_SIZE, MAX_EXPORT_ROWS } from '@/lib/export/constants'
import { EXPORT_ERROR_EMPTY, EXPORT_ERROR_TOO_LARGE, ExportUserError } from '@/lib/export/exportErrors'

export type PaginatedPageResult<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

type FetchPageFn<T, Q> = (query: Q & { page: number; pageSize: number }) => Promise<{
  items?: T[]
  records?: T[]
  totalCount: number
  page?: number
  pageSize?: number
}>

/**
 * Walk a company-scoped paginated list API until all matching rows are loaded
 * (or the safe export limit is exceeded).
 */
export async function fetchAllFilteredRows<T, Q extends object>(options: {
  baseQuery: Q
  fetchPage: FetchPageFn<T, Q>
  pageSize?: number
  maxRows?: number
  getItems?: (result: Awaited<ReturnType<FetchPageFn<T, Q>>>) => T[]
}): Promise<T[]> {
  const pageSize = options.pageSize ?? EXPORT_FETCH_PAGE_SIZE
  const maxRows = options.maxRows ?? MAX_EXPORT_ROWS
  const getItems =
    options.getItems ??
    ((result) => (result.items ?? result.records ?? []) as T[])

  const first = await options.fetchPage({
    ...options.baseQuery,
    page: 1,
    pageSize,
  })
  const firstItems = getItems(first)
  const totalCount = first.totalCount ?? firstItems.length

  if (totalCount === 0 && firstItems.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }

  if (totalCount > maxRows) {
    throw new ExportUserError(EXPORT_ERROR_TOO_LARGE)
  }

  const rows = [...firstItems]
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  for (let page = 2; page <= totalPages; page += 1) {
    const result = await options.fetchPage({
      ...options.baseQuery,
      page,
      pageSize,
    })
    const items = getItems(result)
    rows.push(...items)
    if (rows.length > maxRows) {
      throw new ExportUserError(EXPORT_ERROR_TOO_LARGE)
    }
  }

  if (rows.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }

  return rows.slice(0, maxRows)
}

export function assertExportNotEmpty<T>(rows: T[]): T[] {
  if (rows.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new ExportUserError(EXPORT_ERROR_TOO_LARGE)
  }
  return rows
}
