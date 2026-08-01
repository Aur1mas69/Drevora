import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'

type HelpNavCardProps = {
  to: string
  title: string
  description: string
  icon: LucideIcon
  index?: number
  disabled?: boolean
  unavailableMessage?: string
}

/** Compact Help & Support navigation card (≥44px tap target). */
export function HelpNavCard({
  to,
  title,
  description,
  icon: Icon,
  index = 0,
  disabled = false,
  unavailableMessage,
}: HelpNavCardProps) {
  const isDark = useIsWorkerDarkMode()
  const className = cn(
    workerListCardClass(index, isDark),
    'worker-list-row flex min-h-11 w-full items-center gap-3 text-left',
    disabled && 'pointer-events-none opacity-60',
  )

  const body = (
    <>
      <span
        className={cn(
          'worker-home-icon-well flex size-10 shrink-0 items-center justify-center rounded-xl',
          !isDark && 'bg-[#E8F3FE] text-[#0B68BE]',
        )}
        aria-hidden
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'worker-accent-title block text-[15px] font-semibold leading-snug',
            !isDark && 'text-[color:var(--worker-text)]',
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'worker-accent-secondary mt-0.5 block text-xs leading-snug',
            !isDark && 'text-[color:var(--worker-text-secondary)]',
          )}
        >
          {disabled && unavailableMessage ? unavailableMessage : description}
        </span>
      </span>
      {!disabled ? (
        <ChevronRight
          className={cn(
            'worker-home-chevron size-5 shrink-0',
            !isDark && 'text-[#5499BF]',
          )}
          aria-hidden
        />
      ) : null}
    </>
  )

  if (disabled) {
    return (
      <div className={className} role="group" aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <Link to={to} className={className}>
      {body}
    </Link>
  )
}
