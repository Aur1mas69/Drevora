import { Button } from '@/components/ui/button'
import { CONTACT_PAGE_SIZE_OPTIONS } from '@/lib/contactTypes'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ContactsPaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function ContactsPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: ContactsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#D3E9FC]/70 bg-[#F8FBFF]/80 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-medium text-[#5499BF]">
        Showing {from}–{to} of {totalCount}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-[#5499BF]">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-[10px] border border-[#C5DFFB]/80 bg-white px-2 text-xs font-medium text-[#113C69] focus-visible:border-[#89CFF0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/70 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-500/30"
          >
            {CONTACT_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="h-8 w-8 rounded-[10px] p-0 text-[#0B68BE] hover:bg-[#EEF6FF]"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-[#113C69]">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 w-8 rounded-[10px] p-0 text-[#0B68BE] hover:bg-[#EEF6FF]"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
