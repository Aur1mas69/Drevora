export type WorkersViewMode = 'grid' | 'list'

export const WORKERS_VIEW_MODE_STORAGE_KEY = 'drevora-workers-view-mode'

const DEFAULT_WORKERS_VIEW_MODE: WorkersViewMode = 'grid'

export function parseWorkersViewMode(value: string | null | undefined): WorkersViewMode {
  if (value === 'grid' || value === 'list') {
    return value
  }
  return DEFAULT_WORKERS_VIEW_MODE
}

export function readWorkersViewMode(): WorkersViewMode {
  if (typeof window === 'undefined') {
    return DEFAULT_WORKERS_VIEW_MODE
  }

  try {
    return parseWorkersViewMode(window.localStorage.getItem(WORKERS_VIEW_MODE_STORAGE_KEY))
  } catch {
    return DEFAULT_WORKERS_VIEW_MODE
  }
}

export function writeWorkersViewMode(mode: WorkersViewMode): void {
  if (typeof window === 'undefined') return
  if (mode !== 'grid' && mode !== 'list') return

  try {
    window.localStorage.setItem(WORKERS_VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore quota / private-mode failures; in-memory state still works.
  }
}
