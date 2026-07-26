/**
 * Reusable browser download helpers for original files and ZIP archives.
 * Documents is the first consumer; other modules can adopt later.
 */
import { MAX_ZIP_PDFS } from '@/lib/export/constants'
import { downloadBlob } from '@/lib/export/downloadBlob'
import {
  EXPORT_ERROR_ZIP_TOO_LARGE,
  ExportUserError,
} from '@/lib/export/exportErrors'
import { uniquifyFileNames } from '@/lib/export/fileNames'

export { downloadBlob }

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

/** Map a verified MIME type to a safe file extension. */
export function extensionForMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null
  return MIME_TO_EXTENSION[mimeType.trim().toLowerCase()] ?? null
}

/**
 * Sanitise a download filename while preserving spaces and the real extension.
 * Blocks path separators and empty names.
 */
export function sanitizeDownloadFileName(fileName: string, maxLength = 120): string {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() || 'file'
  const withoutControls = Array.from(baseName)
    .map((char) => {
      const code = char.charCodeAt(0)
      return code < 32 ? '-' : char
    })
    .join('')
  const cleaned = withoutControls
    .replace(/[<>:"|?*]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

  return cleaned || 'file'
}

/**
 * Resolve a human-readable download name, adding a MIME-derived extension
 * only when the original name has none.
 */
export function resolveDownloadFileName(
  originalFileName: string,
  mimeType?: string | null,
): string {
  const safe = sanitizeDownloadFileName(originalFileName)
  const hasExtension = /\.[a-zA-Z0-9]{2,8}$/.test(safe)
  if (hasExtension) return safe

  const extension = extensionForMimeType(mimeType)
  if (!extension) return safe
  return `${safe}${extension}`
}

/** Fetch a Blob from a short-lived signed URL (or any absolute URL). */
export async function fetchBlobFromUrl(url: string): Promise<Blob> {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new ExportUserError('Unable to download file.')
  }

  let response: Response
  try {
    response = await fetch(trimmed)
  } catch {
    throw new ExportUserError('Unable to download file. Please try again.')
  }

  if (!response.ok) {
    throw new ExportUserError('Unable to download file. Please try again.')
  }

  try {
    return await response.blob()
  } catch {
    throw new ExportUserError('Unable to download file. Please try again.')
  }
}

/**
 * Download one file from a signed URL as a Blob with an explicit filename.
 * Prefer this over cross-origin `<a download>` so the browser keeps the name.
 */
export async function downloadFileFromSignedUrl(
  signedUrl: string,
  fileName: string,
): Promise<void> {
  const blob = await fetchBlobFromUrl(signedUrl)
  const safeName = sanitizeDownloadFileName(fileName)
  downloadBlob(blob, safeName)
}

export type ZipFileEntry = {
  fileName: string
  blob: Blob
}

/**
 * Build and download a ZIP archive from in-memory file Blobs.
 * Uses the existing JSZip dependency. Does not upload the ZIP to Storage.
 */
export async function downloadZipArchive(
  entries: ZipFileEntry[],
  zipFileName: string,
  options?: { maxEntries?: number },
): Promise<void> {
  if (entries.length === 0) {
    throw new ExportUserError('No files available to download.')
  }

  const maxEntries = options?.maxEntries ?? MAX_ZIP_PDFS
  if (entries.length > maxEntries) {
    throw new ExportUserError(EXPORT_ERROR_ZIP_TOO_LARGE)
  }

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const names = uniquifyFileNames(
    entries.map((entry) => sanitizeDownloadFileName(entry.fileName)),
  )

  for (let index = 0; index < entries.length; index += 1) {
    const blob = entries[index]?.blob
    if (!blob || blob.size <= 0) {
      throw new ExportUserError(
        'One or more files could not be downloaded. The archive was not created.',
      )
    }
    zip.file(names[index], blob)
  }

  let zipBlob: Blob
  try {
    zipBlob = await zip.generateAsync({ type: 'blob' })
  } catch {
    throw new ExportUserError('Unable to create the ZIP archive. Please try again.')
  }

  if (!zipBlob || zipBlob.size <= 0) {
    throw new ExportUserError('Unable to create the ZIP archive. Please try again.')
  }

  const safeZipName = sanitizeDownloadFileName(zipFileName)
  const withExtension = /\.zip$/i.test(safeZipName)
    ? safeZipName
    : `${safeZipName}.zip`

  downloadBlob(zipBlob, withExtension)
}
