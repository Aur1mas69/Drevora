/** App-private logical root for offline Vehicle Check media keys/paths. */
export const OFFLINE_VEHICLE_CHECK_MEDIA_ROOT = 'offline-vehicle-checks'

export type OfflineMediaWriteResult = {
  /** Logical media key (Filesystem relative path on native; IndexedDB key on web). */
  path: string
  mimeType: string
  byteLength: number
}

export type OfflineMediaStorageErrorCode =
  | 'quota'
  | 'unavailable'
  | 'missing'
  | 'unknown'

export class OfflineMediaStorageError extends Error {
  readonly code: OfflineMediaStorageErrorCode

  constructor(message: string, code: OfflineMediaStorageErrorCode = 'unknown') {
    super(message)
    this.name = 'OfflineMediaStorageError'
    this.code = code
  }
}

export function extensionForMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim()
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  return 'jpg'
}

export function buildOfflineCheckMediaDir(queueItemId: string): string {
  return `${OFFLINE_VEHICLE_CHECK_MEDIA_ROOT}/${queueItemId}`
}

export function buildOfflinePhotoPath(
  queueItemId: string,
  itemKey: string,
  mimeType: string,
): string {
  const safeKey = itemKey.replace(/[^\w.\-]+/g, '-').slice(0, 80) || 'item'
  return `${buildOfflineCheckMediaDir(queueItemId)}/photos/${safeKey}.${extensionForMime(mimeType)}`
}

export function buildOfflineSignaturePath(
  queueItemId: string,
  mimeType: string,
): string {
  return `${buildOfflineCheckMediaDir(queueItemId)}/signature.${extensionForMime(mimeType)}`
}

/** Extract queue item id from a logical media key/path. */
export function queueItemIdFromMediaPath(relativePath: string): string | null {
  const parts = relativePath.split('/').filter(Boolean)
  if (parts[0] !== OFFLINE_VEHICLE_CHECK_MEDIA_ROOT) return null
  return parts[1] || null
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String((error as { name?: unknown }).name) : ''
  const message =
    'message' in error ? String((error as { message?: unknown }).message) : ''
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota/i.test(message) ||
    /storage.*full/i.test(message)
  )
}

export function toOfflineMediaStorageError(error: unknown): OfflineMediaStorageError {
  if (error instanceof OfflineMediaStorageError) return error
  if (isQuotaExceededError(error)) {
    return new OfflineMediaStorageError(
      'Device storage is full. Free some space, then try saving this Vehicle Check offline again.',
      'quota',
    )
  }
  if (error instanceof Error && error.message.trim()) {
    return new OfflineMediaStorageError(error.message.trim().slice(0, 180), 'unknown')
  }
  return new OfflineMediaStorageError(
    'Could not save offline photos or signature on this device.',
    'unknown',
  )
}
