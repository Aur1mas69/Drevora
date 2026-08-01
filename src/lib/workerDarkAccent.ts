import { cn } from '@/lib/utils'

export type WorkerDarkAccentClass = 'worker-accent-mint' | 'worker-accent-indigo'

/** Alternating mint / blue fills for Worker dark-mode list and action cards. */
export function workerDarkAccentClass(
  index: number,
  isDark: boolean,
): WorkerDarkAccentClass | null {
  if (!isDark) return null
  return index % 2 === 0 ? 'worker-accent-mint' : 'worker-accent-indigo'
}

/** Base + optional dark accent classes for a Worker list/action card. */
export function workerAccentCardClass(
  index: number,
  isDark: boolean,
  ...extra: Array<string | false | null | undefined>
): string {
  return cn('worker-accent-card', workerDarkAccentClass(index, isDark), ...extra)
}

type WorkerListCardOptions = {
  /** Hover/active/focus styles for tappable cards. */
  interactive?: boolean
}

/**
 * Shared compact Worker list card surface.
 * Use for Contacts, Timesheet History, Documents history, Consumables, Help lists, etc.
 */
export function workerListCardClass(
  index: number,
  isDark: boolean,
  options?: WorkerListCardOptions,
  ...extra: Array<string | false | null | undefined>
): string {
  return workerAccentCardClass(
    index,
    isDark,
    'worker-list-card',
    options?.interactive ? 'worker-list-card--interactive' : null,
    ...extra,
  )
}
