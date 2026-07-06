import { FileBarChart } from 'lucide-react'
import { driverReportPageCardClass } from './driverReportUiStyles'

type DriverReportsEmptyStateProps = {
  hasActiveFilters: boolean
  onClearFilters?: () => void
}

export function DriverReportsEmptyState({
  hasActiveFilters,
  onClearFilters,
}: DriverReportsEmptyStateProps) {
  return (
    <div className={`${driverReportPageCardClass} px-6 py-14 text-center`}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E8F3FE] text-[#218EE7] ring-1 ring-[#D3E9FC]">
        <FileBarChart className="size-7" strokeWidth={2} />
      </div>
      <p className="mt-4 text-lg font-semibold text-[#113C69]">No driver reports found.</p>
      <p className="mt-2 text-sm text-[#5499BF]">
        {hasActiveFilters
          ? 'Try adjusting your search or filters.'
          : 'Worker reports will appear here once submitted.'}
      </p>
      {hasActiveFilters && onClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-5 text-sm font-semibold text-[#0B68BE] hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
