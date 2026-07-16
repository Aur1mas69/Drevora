export const WORKER_AVATARS_BUCKET = 'worker-avatars'

export const WORKER_AVATAR_SIGNED_URL_EXPIRY_SECONDS = 3600

export const WORKER_AVATAR_MAX_BYTES = 5 * 1024 * 1024

export const WORKER_AVATAR_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value?.trim() && UUID_RE.test(value.trim()))
}

/** Absolute http(s), blob:, or data: URLs — not Storage object paths. */
export function isExternalAvatarUrl(value: string): boolean {
  const trimmed = value.trim()
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:image/')
  )
}

/** Non-empty value that is a Storage object path (not an absolute/external URL). */
export function isWorkerAvatarStoragePath(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && !isExternalAvatarUrl(trimmed)
}

/**
 * Canonical upload path:
 * `{companyId}/worker-avatars/{workerId}/{timestamp}.{ext}`
 */
export function isCanonicalWorkerAvatarPath(path: string): boolean {
  const parts = path.trim().split('/').filter(Boolean)
  return (
    parts.length >= 4 &&
    isUuid(parts[0]) &&
    parts[1] === 'worker-avatars' &&
    isUuid(parts[2])
  )
}

/**
 * Legacy slug path (display-compatible only; not a trusted tenant key):
 * `{companySlug}/{workerId}/{timestamp}.{ext}`
 */
export function isLegacySlugWorkerAvatarPath(path: string): boolean {
  if (!isWorkerAvatarStoragePath(path) || isCanonicalWorkerAvatarPath(path)) {
    return false
  }
  const parts = path.trim().split('/').filter(Boolean)
  return parts.length >= 3 && isUuid(parts[1])
}

function resolveExtension(fileName: string, mimeType: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'png'
  if (lower.endsWith('.webp')) return 'webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg'
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Build a new Worker Avatar object path.
 * Requires a verified company UUID — never a company name or slug.
 */
export function buildWorkerAvatarPath(
  companyId: string,
  workerId: string,
  fileName: string,
  mimeType: string,
): string {
  const trimmedCompanyId = companyId.trim()
  const trimmedWorkerId = workerId.trim()

  if (!isUuid(trimmedCompanyId)) {
    throw new Error('A verified company id is required to upload a worker avatar.')
  }
  if (!isUuid(trimmedWorkerId)) {
    throw new Error('A valid worker id is required to upload a worker avatar.')
  }

  const extension = resolveExtension(fileName, mimeType)
  return `${trimmedCompanyId}/worker-avatars/${trimmedWorkerId}/${Date.now()}.${extension}`
}

/**
 * True when the stored path may be deleted for this tenant/worker.
 * Legacy slug paths are never deleted here — cleanup needs a controlled backfill.
 */
export function canSafelyDeleteWorkerAvatarPath(
  path: string,
  verifiedCompanyId: string,
  workerId: string,
): boolean {
  if (!isCanonicalWorkerAvatarPath(path)) return false
  const parts = path.trim().split('/').filter(Boolean)
  return parts[0] === verifiedCompanyId.trim() && parts[2] === workerId.trim()
}

function resolveMimeType(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase()
  if (
    WORKER_AVATAR_ALLOWED_MIME_TYPES.includes(
      normalizedType as (typeof WORKER_AVATAR_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return normalizedType
  }

  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    : ''

  return EXTENSION_TO_MIME[extension] ?? null
}

export function validateWorkerAvatarFile(file: File): string | null {
  if (file.size > WORKER_AVATAR_MAX_BYTES) {
    return 'Avatar image must be 5 MB or smaller.'
  }

  if (!resolveMimeType(file)) {
    return 'Only JPG, PNG and WEBP images are allowed.'
  }

  return null
}
