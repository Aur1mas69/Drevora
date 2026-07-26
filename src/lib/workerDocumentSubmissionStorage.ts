import {
  DOCUMENT_FILES_BUCKET,
  sanitizeDocumentFileName,
} from '@/lib/documentFileStorage'
import {
  WORKER_SUBMISSION_ALLOWED_MIME_TYPES,
  WORKER_SUBMISSION_IMAGE_MIME_TYPES,
  WORKER_SUBMISSION_MAX_BYTES,
  WORKER_SUBMISSION_MAX_FILES,
  WORKER_SUBMISSION_PDF_MIME_TYPE,
} from '@/lib/workerDocumentSubmissionTypes'

export { DOCUMENT_FILES_BUCKET }

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export function buildWorkerSubmissionFilePath(input: {
  companyId: string
  workerId: string
  submissionId: string
  attachmentId: string
  fileName: string
}): string {
  const safeName = sanitizeDocumentFileName(input.fileName)
  return `worker-submissions/${input.companyId}/${input.workerId}/${input.submissionId}/${input.attachmentId}-${safeName}`
}

export function resolveWorkerSubmissionMimeType(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase()
  if (
    (WORKER_SUBMISSION_ALLOWED_MIME_TYPES as readonly string[]).includes(normalizedType)
  ) {
    return normalizedType
  }

  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    : ''
  return EXTENSION_TO_MIME[extension] ?? null
}

export function isWorkerSubmissionPdfMime(mimeType: string): boolean {
  return mimeType === WORKER_SUBMISSION_PDF_MIME_TYPE
}

export function isWorkerSubmissionImageMime(mimeType: string): boolean {
  return (WORKER_SUBMISSION_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
}

export function formatFileSizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sameSelectedFile(a: File, b: File): boolean {
  return (
    a.name === b.name &&
    a.size === b.size &&
    a.lastModified === b.lastModified &&
    a.type === b.type
  )
}

/** Client-side attachment set rules before any Storage upload. */
export function validateWorkerSubmissionFiles(files: File[]): string | null {
  if (files.length < 1) {
    return 'Attach at least one PDF or image file.'
  }
  if (files.length > WORKER_SUBMISSION_MAX_FILES) {
    return `You can attach at most ${WORKER_SUBMISSION_MAX_FILES} files.`
  }

  for (const file of files) {
    if (file.size > WORKER_SUBMISSION_MAX_BYTES) {
      return `"${file.name}" must be 10 MB or smaller.`
    }

    const mimeType = resolveWorkerSubmissionMimeType(file)
    if (!mimeType) {
      return `"${file.name}" is not a supported file type. Use PDF, JPG, PNG or WEBP.`
    }
  }

  return null
}

/**
 * Merge newly picked files into the current selection.
 * Rejects only the invalid/new extras while keeping already-valid files.
 */
export function mergeWorkerSubmissionFiles(
  current: File[],
  incoming: File[],
): { files: File[]; error: string | null } {
  if (incoming.length === 0) {
    return { files: current, error: null }
  }

  const next = [...current]
  let error: string | null = null

  for (const file of incoming) {
    if (next.some((existing) => sameSelectedFile(existing, file))) {
      error = `"${file.name}" is already selected.`
      continue
    }

    if (next.length >= WORKER_SUBMISSION_MAX_FILES) {
      error = `You can attach at most ${WORKER_SUBMISSION_MAX_FILES} files.`
      break
    }

    if (file.size > WORKER_SUBMISSION_MAX_BYTES) {
      error = `"${file.name}" must be 10 MB or smaller.`
      continue
    }

    const mimeType = resolveWorkerSubmissionMimeType(file)
    if (!mimeType) {
      error = `"${file.name}" is not a supported file type. Use PDF, JPG, PNG or WEBP.`
      continue
    }

    next.push(file)
  }

  return { files: next, error }
}
