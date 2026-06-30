import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { HolidayRequestStatusFilter } from '@/lib/holidayRequestTypes'
import type { Driver } from '@/services/driversService'
import { Filter, Plus, Search, X } from 'lucide-react'

const selectClassName =
  'h-9 w-full min-w-[128px] rounded-[10px] border border-[rgba(75,120,220,0.12)] bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100'

type HolidayRequestsToolbarProps = {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  statusFilter: HolidayRequestStatusFilter
  onStatusFilterChange: (value: HolidayRequestStatusFilter) => void
  workerFilter: string
  onWorkerFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  workers: Driver[]
  hasActiveFilters: boolean
  onClearFilters: () => void
  onNewRequest: () => void
}

export function HolidayRequestsToolbar({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  workerFilter,
  onWorkerFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  workers,
  hasActiveFilters,
  onClearFilters,
  onNewRequest,
}: HolidayRequestsToolbarProps) {
  const sortedWorkers = [...workers].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
  )

  return (
    <div className="space-y-3 rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white p-3 shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search worker or reason…"
            className="h-9 rounded-[10px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] pl-8 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={onNewRequest}
            className="h-9 rounded-[10px] bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-[#1d4ed8]"
          >
            <Plus className="mr-1 size-3.5" />
            New Holiday Request
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Filter className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Filters</span>
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(event.target.value as HolidayRequestStatusFilter)
          }
          className={selectClassName}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select
          value={workerFilter}
          onChange={(event) => onWorkerFilterChange(event.target.value)}
          className={selectClassName}
          aria-label="Filter by worker"
        >
          <option value="all">All workers</option>
          {sortedWorkers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.firstName} {worker.lastName}
            </option>
          ))}
        </select>

        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => onDateFromChange(event.target.value)}
          className="h-9 w-[140px] rounded-[10px] border-[rgba(75,120,220,0.12)] bg-white px-2 text-xs"
          aria-label="Date from"
        />
        <span className="text-xs text-slate-400">to</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => onDateToChange(event.target.value)}
          className="h-9 w-[140px] rounded-[10px] border-[rgba(75,120,220,0.12)] bg-white px-2 text-xs"
          aria-label="Date to"
        />

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onClearFilters}
            className="h-9 rounded-[10px] px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="mr-1 size-3.5" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
