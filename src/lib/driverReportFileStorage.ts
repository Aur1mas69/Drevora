export const DRIVER_REPORT_FILES_BUCKET = 'driver-report-files'

export const DRIVER_REPORT_FILE_MAX_BYTES = 10 * 1024 * 1024

export const DRIVER_REPORT_FILE_ALLOWED_MIME_TYPES = [
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

export function isExternalDriverReportUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

export function sanitizeDriverReportFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() || 'attachment'
  const sanitized = baseName
    .replace(/[^\w.\-() ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  return sanitized || 'attachment'
}

export function buildDriverReportFilePath(
  companyId: string,
  reportId: string,
  fileName: string,
): string {
  const timestamp = Date.now()
  const safeName = sanitizeDriverReportFileName(fileName)
  return `driver-reports/${companyId}/${reportId}/${timestamp}-${safeName}`
}

export function getDriverReportFileDisplayName(storagePathOrUrl: string): string {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) return 'Attachment'

  if (isExternalDriverReportUrl(trimmed)) {
    try {
      const url = new URL(trimmed)
      const segment = url.pathname.split('/').filter(Boolean).pop()
      return segment ? decodeURIComponent(segment) : 'Attachment'
    } catch {
      return 'Attachment'
    }
  }

  const segment = trimmed.split('/').filter(Boolean).pop()
  if (!segment) return 'Attachment'
  const withoutTimestamp = segment.replace(/^\d+-/, '')
  return withoutTimestamp || segment
}

export function validateDriverReportFile(file: File): string | null {
  if (file.size > DRIVER_REPORT_FILE_MAX_BYTES) {
    return 'File must be 10 MB or smaller.'
  }

  const normalizedType = file.type.trim().toLowerCase()
  const allowed = DRIVER_REPORT_FILE_ALLOWED_MIME_TYPES as readonly string[]
  if (allowed.includes(normalizedType)) return null

  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    : ''
  const mime = EXTENSION_TO_MIME[extension]
  if (mime && allowed.includes(mime)) return null

  return 'Only PDF, JPG, PNG and WEBP files are allowed.'
}
