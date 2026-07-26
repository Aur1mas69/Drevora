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

export function formatFileSizeBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Client-side attachment set rules before any Storage upload. */
export function validateWorkerSubmissionFiles(files: File[]): string | null {
  if (files.length < 1) {
    return 'Attach one PDF or one to five images.'
  }
  if (files.length > WORKER_SUBMISSION_MAX_FILES) {
    return `You can attach at most ${WORKER_SUBMISSION_MAX_FILES} files.`
  }

  let pdfCount = 0
  let imageCount = 0

  for (const file of files) {
    if (file.size > WORKER_SUBMISSION_MAX_BYTES) {
      return `"${file.name}" must be 10 MB or smaller.`
    }

    const mimeType = resolveWorkerSubmissionMimeType(file)
    if (!mimeType) {
      return `"${file.name}" is not a supported file type. Use PDF, JPG, PNG or WEBP.`
    }

    if (mimeType === WORKER_SUBMISSION_PDF_MIME_TYPE) {
      pdfCount += 1
    } else if ((WORKER_SUBMISSION_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
      imageCount += 1
    } else {
      return `"${file.name}" is not a supported file type.`
    }
  }

  if (pdfCount > 0 && imageCount > 0) {
    return 'Send either one PDF or images — not both in the same submission.'
  }
  if (pdfCount > 1) {
    return 'Only one PDF can be sent per submission.'
  }
  if (pdfCount === 0 && imageCount === 0) {
    return 'Attach one PDF or one to five images.'
  }

  return null
}
