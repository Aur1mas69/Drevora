import { Plus } from 'lucide-react'

type WorkerAvailableSlotCardProps = {
  onAddWorker: () => void
  slotNumber?: number
  /** Visual only — muted/disabled when Add Worker is not allowed. */
  addEnabled?: boolean
}

export function WorkerAvailableSlotCard({
  onAddWorker,
  slotNumber,
  addEnabled = true,
}: WorkerAvailableSlotCardProps) {
  const label =
    slotNumber != null
      ? `Available Worker slot ${slotNumber}. Add Worker`
      : 'Available Worker slot. Add Worker'

  if (!addEnabled) {
    return (
      <div
        role="status"
        aria-label={
          slotNumber != null
            ? `Available Worker slot ${slotNumber}. Add Worker unavailable`
            : 'Available Worker slot. Add Worker unavailable'
        }
        className="flex h-full min-h-[176px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/70 bg-[#F8FAFC]/50 px-3 py-4 text-center opacity-70 dark:border-white/10 dark:bg-slate-900/20"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-slate-100/80 text-slate-400 ring-1 ring-slate-200/70 dark:bg-slate-800/40 dark:text-slate-500 dark:ring-white/10">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        <span className="mt-2 text-[13px] font-semibold text-slate-400 dark:text-slate-500">
          Available Worker slot
        </span>
        <span className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-600">
          Allowance reached
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onAddWorker}
      aria-label={label}
      className="flex h-full min-h-[176px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#BFE3F5]/80 bg-[#F8FBFF]/55 px-3 py-4 text-center shadow-none transition-[border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#89CFF0] hover:bg-[#F0F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-white/15 dark:bg-slate-900/25 dark:hover:border-blue-400/30 dark:hover:bg-slate-900/40"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-white/70 text-[#5499BF] ring-1 ring-[#D3E9FC]/70 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-white/10">
        <Plus className="size-4" aria-hidden="true" />
      </span>
      <span className="mt-2 text-[13px] font-semibold text-[#5499BF] dark:text-slate-400">
        Available Worker slot
      </span>
      <span className="mt-0.5 text-[11px] font-medium text-[#89CFF0] dark:text-slate-500">
        Add Worker
      </span>
    </button>
  )
}
