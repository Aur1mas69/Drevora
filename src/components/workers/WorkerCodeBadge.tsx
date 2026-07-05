import { cn } from '@/lib/utils'

type WorkerCodeBadgeProps = {
  code: string | null | undefined
  className?: string
  emptyLabel?: string | false
}

export function WorkerCodeBadge({
  code,
  className,
  emptyLabel = false,
}: WorkerCodeBadgeProps) {
  if (!code) {
    if (emptyLabel) {
      return (
        <span
          className={cn(
            'inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-slate-200/80 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-white/10',
            className,
          )}
        >
          {emptyLabel}
        </span>
      )
    }

    return (
      <span className={cn('text-xs font-medium text-slate-400/80', className)}>
        —
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-[#EEF6FF] px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] text-[#0B68BE] ring-1 ring-[#C5DFFB]/70 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60',
        className,
      )}
    >
      {code}
    </span>
  )
}
