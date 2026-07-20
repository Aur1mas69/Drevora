import type { WorkersViewMode } from '@/lib/workersViewMode'
import { LayoutGrid, List } from 'lucide-react'

type WorkersViewSwitcherProps = {
  value: WorkersViewMode
  onChange: (mode: WorkersViewMode) => void
  disabled?: boolean
}

const optionClassName = (active: boolean) =>
  [
    'inline-flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-[14px] px-3 text-sm font-semibold transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BFE3F5]/80',
    'dark:focus-visible:ring-blue-400/50',
    'disabled:pointer-events-none disabled:opacity-60',
    active
      ? 'bg-gradient-to-br from-[#218EE7] to-[#0B68BE] text-white shadow-[0_6px_16px_rgba(33,142,231,0.22)]'
      : 'bg-transparent text-[#0B68BE] hover:bg-white/70 dark:text-blue-300 dark:hover:bg-slate-800/70',
  ].join(' ')

export function WorkersViewSwitcher({
  value,
  onChange,
  disabled = false,
}: WorkersViewSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Workers view"
      className="inline-flex h-11 w-full shrink-0 items-stretch rounded-2xl border border-[#BFE3F5] bg-[#E8F3FE] p-1 shadow-sm dark:border-white/10 dark:bg-slate-900/60 sm:w-auto"
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === 'grid'}
        aria-label="Grid view"
        title="Grid"
        onClick={() => onChange('grid')}
        className={optionClassName(value === 'grid')}
      >
        <LayoutGrid className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === 'list'}
        aria-label="List view"
        title="List"
        onClick={() => onChange('list')}
        className={optionClassName(value === 'list')}
      >
        <List className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  )
}
