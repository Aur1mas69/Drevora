import { Button } from '@/components/ui/button'
import { WorkerAvailableSlotCard } from '@/components/workers/WorkerAvailableSlotCard'
import { WorkerCard } from '@/components/workers/WorkerCard'
import type { WorkerSlotItem } from '@/lib/workerPlanSlots'
import type { Driver } from '@/services/driversService'

type WorkersCardGridProps = {
  items: WorkerSlotItem[]
  page: number
  totalPages: number
  slotFrom: number
  slotTo: number
  totalSlots: number
  showingWorkersOnly: boolean
  /** Visual only for available-slot mute/disabled styling. */
  canAddWorker?: boolean
  onPageChange: (page: number) => void
  onAddWorker: () => void
  onEditWorker: (driver: Driver) => void
  onDeleteWorker: (driver: Driver) => void
}

export function WorkersCardGrid({
  items,
  page,
  totalPages,
  slotFrom,
  slotTo,
  totalSlots,
  showingWorkersOnly,
  canAddWorker = true,
  onPageChange,
  onAddWorker,
  onEditWorker,
  onDeleteWorker,
}: WorkersCardGridProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
        {items.map((item) =>
          item.kind === 'worker' ? (
            <WorkerCard
              key={item.key}
              driver={item.driver}
              onEdit={onEditWorker}
              onDelete={onDeleteWorker}
            />
          ) : (
            <WorkerAvailableSlotCard
              key={item.key}
              slotNumber={item.slotNumber}
              onAddWorker={onAddWorker}
              addEnabled={canAddWorker}
            />
          ),
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#D3E9FC]/80 bg-[#F8FBFF]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-slate-900/50">
          <p className="text-sm text-[#5499BF] dark:text-slate-400">
            {showingWorkersOnly
              ? `Showing ${slotFrom}–${slotTo} of ${totalSlots}`
              : `Slots ${slotFrom}–${slotTo} of ${totalSlots}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-9 rounded-[10px] border-[#C5DFFB] text-sm dark:border-white/15"
            >
              Previous
            </Button>
            <span className="text-sm font-medium text-[#113C69] dark:text-slate-200">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-9 rounded-[10px] border-[#C5DFFB] text-sm dark:border-white/15"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function WorkersCardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[176px] animate-pulse rounded-xl border border-[#D3E9FC]/70 bg-[#F5FAFF] p-2.5 dark:border-white/10 dark:bg-slate-800/50"
        >
          <div className="size-11 rounded-full bg-blue-100 dark:bg-slate-700/60" />
          <div className="mt-2.5 h-2.5 w-2/3 rounded-full bg-blue-100 dark:bg-slate-700/60" />
          <div className="mt-1.5 h-2.5 w-1/3 rounded-full bg-blue-50 dark:bg-slate-700/40" />
          <div className="mt-5 h-5 w-16 rounded-full bg-blue-100 dark:bg-slate-700/50" />
          <div className="mt-1.5 h-5 w-20 rounded-full bg-blue-50 dark:bg-slate-700/40" />
        </div>
      ))}
    </div>
  )
}
