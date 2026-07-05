import { Button } from '@/components/ui/button'
import { CONSUMABLE_PAGE_SIZE_OPTIONS } from '@/lib/consumableTypes'
import {
  adminHeading,
  adminSelectXs,
  adminTableFooter,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ConsumablesPaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function ConsumablesPagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: ConsumablesPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <div
      className={`flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${adminTableFooter}`}
    >
      <p className={`text-xs font-medium ${adminTextMuted}`}>
        Showing {from}–{to} of {totalCount}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className={`flex items-center gap-1.5 text-xs font-medium ${adminTextMuted}`}>
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className={adminSelectXs}
          >
            {CONSUMABLE_PAGE_SIZE_OPTIONS.map((size) => (
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
            className="h-8 rounded-[8px] px-2"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className={`min-w-[72px] text-center text-xs font-semibold ${adminHeading}`}>
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="h-8 rounded-[8px] px-2"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
