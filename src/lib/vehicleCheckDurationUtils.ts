export function calculateInspectionDurationSeconds(
  startedAt: string | Date,
  completedAt: string | Date = new Date(),
): number | null {
  const startMs =
    startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime()
  const endMs =
    completedAt instanceof Date ? completedAt.getTime() : new Date(completedAt).getTime()

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null
  }

  return Math.floor((endMs - startMs) / 1000)
}

export function formatInspectionDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—'

  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function isValidInspectionStartedAt(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return !Number.isNaN(new Date(value).getTime())
}
