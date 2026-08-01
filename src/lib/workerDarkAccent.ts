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
