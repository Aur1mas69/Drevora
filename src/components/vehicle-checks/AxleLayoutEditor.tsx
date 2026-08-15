import { cn } from '@/lib/utils'
import { useWorkerChromeText } from '@/i18n/workerLocaleContext'
import type { AxleWheelLayout } from '@/lib/tyreCheckTypes'

type AxleLayoutEditorProps = {
  /** e.g. "Truck" or "Trailer" — used only for the axle row labels. */
  unitLabel: string
  axleLayouts: AxleWheelLayout[]
  onChange: (next: AxleWheelLayout[]) => void
  disabled?: boolean
  /** Compact spacing for tight mobile setup screens. */
  compact?: boolean
}

/**
 * Per-axle Single/Dual picker shared by Worker Tyre Check setup and Admin
 * Tyre Check Configuration. Single = 2 tyres (left/right); Dual = 4 tyres
 * (outer/inner left/right). Purely a layout choice — never edits an existing
 * Tyre Check's own recorded positions.
 */
export function AxleLayoutEditor({
  unitLabel,
  axleLayouts,
  onChange,
  disabled = false,
  compact = false,
}: AxleLayoutEditorProps) {
  const singleLabel = useWorkerChromeText('tyreChecks.single', 'Single')
  const dualLabel = useWorkerChromeText('tyreChecks.dual', 'Dual')
  function setAxle(index: number, layout: AxleWheelLayout) {
    const next = axleLayouts.slice()
    next[index] = layout
    onChange(next)
  }

  return (
    <div className={cn('space-y-2', compact ? 'space-y-1.5' : 'space-y-2')}>
      {axleLayouts.map((layout, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-white/10 dark:bg-slate-800/60',
            compact ? 'h-11' : 'h-12',
          )}
        >
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {unitLabel} axle {index + 1}
          </span>
          <div className="flex overflow-hidden rounded-xl border border-slate-300 dark:border-white/15">
            {(['single', 'dual'] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={disabled}
                aria-pressed={layout === option}
                onClick={() => setAxle(index, option)}
                className={cn(
                  'worker-axle-toggle px-3 py-1.5 text-xs font-bold uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  layout === option
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {option === 'single' ? singleLabel : dualLabel}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
