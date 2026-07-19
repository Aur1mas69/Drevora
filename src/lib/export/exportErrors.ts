export const EXPORT_ERROR_EMPTY = 'No records match the current filters.'
export const EXPORT_ERROR_GENERIC = 'The export could not be generated. Please try again.'
export const EXPORT_ERROR_TOO_LARGE =
  'The selected export is too large. Narrow the filters and try again.'
export const EXPORT_ERROR_ZIP_TOO_LARGE =
  'Too many records selected. Select up to 100 records and try again.'
export const EXPORT_ERROR_IMAGES_PARTIAL = 'Some images could not be included.'

export class ExportUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportUserError'
  }
}

/** Map unknown failures to a safe user-facing message (no SQL/tokens/UUIDs). */
export function toExportUserMessage(error: unknown, fallback = EXPORT_ERROR_GENERIC): string {
  if (error instanceof ExportUserError) return error.message
  if (error instanceof Error) {
    const message = error.message.trim()
    if (
      message === EXPORT_ERROR_EMPTY ||
      message === EXPORT_ERROR_TOO_LARGE ||
      message === EXPORT_ERROR_ZIP_TOO_LARGE ||
      message === EXPORT_ERROR_IMAGES_PARTIAL
    ) {
      return message
    }
  }
  return fallback
}
