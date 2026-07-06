export const DOCUMENT_FILES_BUCKET = 'document-files'

export const DOCUMENT_FILE_MAX_BYTES = 10 * 1024 * 1024

export const DOCUMENT_FILE_ALLOWED_MIME_TYPES = [
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

export function isExternalDocumentUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

export function sanitizeDocumentFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() || 'document'
  const sanitized = baseName
    .replace(/[^\w.\-() ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

  return sanitized || 'document'
}

export function buildDocumentFilePath(
  companyId: string,
  documentId: string,
  fileName: string,
): string {
  const timestamp = Date.now()
  const safeName = sanitizeDocumentFileName(fileName)
  return `documents/${companyId}/${documentId}/${timestamp}-${safeName}`
}

export function getDocumentFileDisplayName(storagePathOrUrl: string): string {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) return 'Document file'

  if (isExternalDocumentUrl(trimmed)) {
    try {
      const url = new URL(trimmed)
      const segment = url.pathname.split('/').filter(Boolean).pop()
      return segment ? decodeURIComponent(segment) : 'Document file'
    } catch {
      return 'Document file'
    }
  }

  const segment = trimmed.split('/').pop() ?? trimmed
  const withoutTimestamp = segment.replace(/^\d+-/, '')
  return withoutTimestamp || segment || 'Document file'
}

function resolveMimeType(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase()
  if (
    DOCUMENT_FILE_ALLOWED_MIME_TYPES.includes(
      normalizedType as (typeof DOCUMENT_FILE_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return normalizedType
  }

  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    : ''
  return EXTENSION_TO_MIME[extension] ?? null
}

export function validateDocumentFile(file: File): string | null {
  if (file.size > DOCUMENT_FILE_MAX_BYTES) {
    return 'File must be 10 MB or smaller.'
  }

  const mimeType = resolveMimeType(file)
  if (!mimeType) {
    return 'Only PDF, JPG, PNG and WEBP files are allowed.'
  }

  return null
}
