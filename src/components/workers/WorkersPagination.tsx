import { Button } from '@/components/ui/button'

export const WORKER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_WORKER_PAGE_SIZE = 25

type WorkersPaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function WorkersPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: WorkersPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex flex-col gap-3 border-t border-[#D3E9FC]/70 bg-[#F8FBFF]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#5499BF]">
        Showing {from}–{to} of {totalCount}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-9 rounded-[10px] border border-[#C5DFFB]/80 bg-white px-2 text-sm font-medium text-[#113C69]"
          aria-label="Rows per page"
        >
          {WORKER_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-9 rounded-[10px] border-[#C5DFFB] text-sm"
        >
          Previous
        </Button>
        <span className="text-sm font-medium text-[#113C69]">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-9 rounded-[10px] border-[#C5DFFB] text-sm"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
