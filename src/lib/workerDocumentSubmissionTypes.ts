export const WORKER_SUBMISSION_DOCUMENT_TYPES = [
  'CMR',
  'POD / Delivery Note',
  'Receipt',
  'Vehicle / Load Document',
  'Other',
] as const

export type WorkerSubmissionDocumentType =
  (typeof WORKER_SUBMISSION_DOCUMENT_TYPES)[number]

export const WORKER_SUBMISSION_REVIEW_STATUSES = [
  'pending_review',
  'reviewed',
  'rejected',
] as const

export type WorkerSubmissionReviewStatus =
  (typeof WORKER_SUBMISSION_REVIEW_STATUSES)[number]

export const WORKER_SUBMISSION_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const WORKER_SUBMISSION_PDF_MIME_TYPE = 'application/pdf' as const

export const WORKER_SUBMISSION_ALLOWED_MIME_TYPES = [
  WORKER_SUBMISSION_PDF_MIME_TYPE,
  ...WORKER_SUBMISSION_IMAGE_MIME_TYPES,
] as const

export const WORKER_SUBMISSION_MAX_FILES = 5
export const WORKER_SUBMISSION_MAX_BYTES = 10 * 1024 * 1024

export type WorkerDocumentSubmissionAttachment = {
  id: string
  submissionId: string
  filePath: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  sortOrder: number
  createdAt: string
}

export type WorkerDocumentSubmission = {
  id: string
  companyId: string
  workerId: string
  documentType: WorkerSubmissionDocumentType
  customDocumentName: string | null
  referenceNumber: string | null
  notes: string | null
  reviewStatus: WorkerSubmissionReviewStatus
  rejectionReason: string | null
  submittedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  updatedAt: string
  attachments: WorkerDocumentSubmissionAttachment[]
}

export type CreateWorkerDocumentSubmissionInput = {
  documentType: WorkerSubmissionDocumentType
  customDocumentName?: string | null
  referenceNumber?: string | null
  notes?: string | null
  files: File[]
}

export function getWorkerSubmissionDisplayName(
  submission: Pick<WorkerDocumentSubmission, 'documentType' | 'customDocumentName'>,
): string {
  if (submission.documentType === 'Other') {
    return submission.customDocumentName?.trim() || 'Other'
  }
  return submission.documentType
}

export function getWorkerSubmissionReviewLabel(
  status: WorkerSubmissionReviewStatus,
): string {
  switch (status) {
    case 'pending_review':
      return 'Pending review'
    case 'reviewed':
      return 'Reviewed'
    case 'rejected':
      return 'Rejected'
    default:
      return status
  }
}

export function isWorkerSubmissionDocumentType(
  value: string,
): value is WorkerSubmissionDocumentType {
  return (WORKER_SUBMISSION_DOCUMENT_TYPES as readonly string[]).includes(value)
}
