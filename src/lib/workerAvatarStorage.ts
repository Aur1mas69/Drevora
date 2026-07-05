export const WORKER_AVATARS_BUCKET = 'worker-avatars'

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

export function isExternalAvatarUrl(value: string): boolean {
  const trimmed = value.trim()
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:image/')
  )
}

export function isWorkerAvatarStoragePath(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && !isExternalAvatarUrl(trimmed)
}

export function sanitizeCompanyPathSegment(
  company: string | null | undefined,
): string {
  const slug = (company?.trim() || 'default')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  return slug || 'default'
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

export function buildWorkerAvatarPath(
  company: string | null | undefined,
  workerId: string,
  fileName: string,
  mimeType: string,
): string {
  const companySlug = sanitizeCompanyPathSegment(company)
  const extension = resolveExtension(fileName, mimeType)
  return `${companySlug}/${workerId}/${Date.now()}.${extension}`
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
