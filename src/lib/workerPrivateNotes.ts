/** Worker private notes — shared types and client-side helpers. */

export const WORKER_PRIVATE_NOTE_TITLE_MAX = 120
export const WORKER_PRIVATE_NOTE_CONTENT_MAX = 4000

export type WorkerPrivateNote = {
  id: string
  companyId: string
  driverId: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export function validateWorkerPrivateNoteTitle(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter a title.'
  if (trimmed.length > WORKER_PRIVATE_NOTE_TITLE_MAX) {
    return `Title must be ${WORKER_PRIVATE_NOTE_TITLE_MAX} characters or fewer.`
  }
  return null
}

export function validateWorkerPrivateNoteContent(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter a note.'
  if (trimmed.length > WORKER_PRIVATE_NOTE_CONTENT_MAX) {
    return `Note must be ${WORKER_PRIVATE_NOTE_CONTENT_MAX} characters or fewer.`
  }
  return null
}

/** Pinned first, then most recently updated. */
export function sortWorkerPrivateNotes<T extends { isPinned: boolean; updatedAt: string }>(
  notes: T[],
): T[] {
  return [...notes].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1
    }
    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export function previewWorkerPrivateNoteContent(
  content: string,
  maxLength = 96,
): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}
