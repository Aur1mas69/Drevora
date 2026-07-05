export const CONSUMABLE_RECEIPTS_BUCKET = 'consumable-receipts'

export const CONSUMABLE_RECEIPT_MAX_BYTES = 10 * 1024 * 1024

export const CONSUMABLE_RECEIPT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export function isExternalReceiptUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

export function isConsumableReceiptStoragePath(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && !isExternalReceiptUrl(trimmed)
}

export function isImageReceiptPath(value: string): boolean {
  const lower = value.toLowerCase()
  return /\.(jpe?g|png|webp)(\?.*)?$/i.test(lower)
}

export function sanitizeReceiptFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() || 'receipt'
  const sanitized = baseName
    .replace(/[^\w.\-() ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

  return sanitized || 'receipt'
}

export function buildConsumableReceiptPath(
  companyId: string,
  consumableId: string,
  fileName: string,
): string {
  const timestamp = Date.now()
  const safeName = sanitizeReceiptFileName(fileName)
  return `consumables/${companyId}/${consumableId}/${timestamp}-${safeName}`
}

export function getReceiptDisplayName(storagePathOrUrl: string): string {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) return 'Receipt'

  if (isExternalReceiptUrl(trimmed)) {
    try {
      const url = new URL(trimmed)
      const segment = url.pathname.split('/').filter(Boolean).pop()
      return segment ? decodeURIComponent(segment) : 'Receipt'
    } catch {
      return 'Receipt'
    }
  }

  const segment = trimmed.split('/').pop() ?? trimmed
  const withoutTimestamp = segment.replace(/^\d+-/, '')
  return withoutTimestamp || segment || 'Receipt'
}

function resolveMimeType(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase()
  if (
    CONSUMABLE_RECEIPT_ALLOWED_MIME_TYPES.includes(
      normalizedType as (typeof CONSUMABLE_RECEIPT_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return normalizedType
  }

  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    : ''
  return EXTENSION_TO_MIME[extension] ?? null
}

export function validateConsumableReceiptFile(file: File): string | null {
  if (file.size > CONSUMABLE_RECEIPT_MAX_BYTES) {
    return 'Receipt file must be 10 MB or smaller.'
  }

  const mimeType = resolveMimeType(file)
  if (!mimeType) {
    return 'Only JPG, PNG, WEBP and PDF files are allowed.'
  }

  return null
}
