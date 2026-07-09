/** Private bucket for vehicle check defect photos and worker signature images. */
export const VEHICLE_CHECK_PHOTOS_BUCKET = 'vehicle-check-photos'

export const VEHICLE_CHECK_PHOTO_MAX_BYTES = 3 * 1024 * 1024

export const VEHICLE_CHECK_PHOTO_ALLOWED_MIME_TYPES = [
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

export function isExternalVehicleCheckPhotoUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || value.trim().startsWith('blob:')
}

export function isVehicleCheckPhotoStoragePath(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && !isExternalVehicleCheckPhotoUrl(trimmed)
}

export function sanitizeVehicleCheckPhotoFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() || 'defect-photo'
  const sanitized = baseName
    .replace(/[^\w.\-() ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

  return sanitized || 'defect-photo'
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^\w.\-() ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return sanitized || 'item'
}

export function buildVehicleCheckDefectPhotoPath(
  vehicleId: string,
  checkId: string,
  category: string,
  itemName: string,
  fileName: string,
): string {
  const timestamp = Date.now()
  const safeName = sanitizeVehicleCheckPhotoFileName(fileName)
  const itemKey = sanitizePathSegment(`${category}-${itemName}`)
  return `vehicles/${vehicleId}/checks/${checkId}/${itemKey}/${timestamp}-${safeName}`
}

export function buildVehicleCheckSignaturePath(vehicleId: string, checkId: string): string {
  const timestamp = Date.now()
  return `vehicles/${vehicleId}/checks/${checkId}/signature/${timestamp}-worker-signature.jpg`
}

export function getVehicleCheckPhotoDisplayName(storagePathOrUrl: string): string {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) return 'Defect photo'

  if (isExternalVehicleCheckPhotoUrl(trimmed)) {
    try {
      const url = new URL(trimmed)
      const segment = url.pathname.split('/').filter(Boolean).pop()
      return segment ? decodeURIComponent(segment) : 'Defect photo'
    } catch {
      return 'Defect photo'
    }
  }

  const segment = trimmed.split('/').pop() ?? trimmed
  const withoutTimestamp = segment.replace(/^\d+-/, '')
  return withoutTimestamp || segment || 'Defect photo'
}

function resolveMimeType(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase()
  if (
    VEHICLE_CHECK_PHOTO_ALLOWED_MIME_TYPES.includes(
      normalizedType as (typeof VEHICLE_CHECK_PHOTO_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return normalizedType
  }

  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    : ''
  return EXTENSION_TO_MIME[extension] ?? null
}

export function validateVehicleCheckPhotoFile(file: File): string | null {
  if (file.size > VEHICLE_CHECK_PHOTO_MAX_BYTES) {
    return 'Photo must be 3 MB or smaller after compression.'
  }

  const mimeType = resolveMimeType(file)
  if (!mimeType) {
    return 'Only JPG, PNG and WEBP photos are allowed.'
  }

  return null
}
