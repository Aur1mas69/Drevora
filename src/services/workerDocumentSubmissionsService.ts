import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  getWorkerSubmissionDisplayName,
  isWorkerSubmissionDocumentType,
  type CreateWorkerDocumentSubmissionInput,
  type UpdateWorkerDocumentSubmissionMetadataInput,
  type WorkerDocumentSubmission,
  type WorkerDocumentSubmissionAttachment,
  type WorkerSubmissionDocumentType,
  type WorkerSubmissionReviewStatus,
} from '@/lib/workerDocumentSubmissionTypes'
import {
  cleanupWorkerSubmissionStagingFiles,
  uploadWorkerSubmissionFiles,
  WorkerDocumentSubmissionStorageError,
} from '@/services/workerDocumentSubmissionStorageService'

export class WorkerDocumentSubmissionsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerDocumentSubmissionsServiceError'
  }
}

type SubmissionRow = {
  id: string
  company_id: string
  worker_id: string
  document_type: string
  custom_document_name: string | null
  reference_number: string | null
  notes: string | null
  review_status: string
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: string | null
  delete_reason?: string | null
}

type AttachmentRow = {
  id: string
  submission_id: string
  file_path: string
  original_file_name: string
  mime_type: string
  file_size_bytes: number
  sort_order: number
  created_at: string
}

const SUBMISSION_SELECT_BASE =
  'id, company_id, worker_id, document_type, custom_document_name, reference_number, notes, review_status, rejection_reason, submitted_at, reviewed_at, reviewed_by, created_at, updated_at'

const SUBMISSION_SELECT_WITH_LIFECYCLE =
  `${SUBMISSION_SELECT_BASE}, deleted_at, deleted_by, delete_reason`

function isMissingTableError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? ''
  return (
    normalized.includes('worker_document_submissions') ||
    normalized.includes('worker_document_submission_attachments') ||
    normalized.includes('could not find the table') ||
    normalized.includes('schema cache')
  )
}

function isMissingLifecycleColumnError(message: string | undefined): boolean {
  const normalized = message?.toLowerCase() ?? ''
  return (
    normalized.includes('deleted_at') ||
    normalized.includes('deleted_by') ||
    normalized.includes('delete_reason') ||
    normalized.includes('does not exist')
  )
}

function mapAttachment(row: AttachmentRow): WorkerDocumentSubmissionAttachment {
  return {
    id: row.id,
    submissionId: row.submission_id,
    filePath: row.file_path,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function mapSubmission(
  row: SubmissionRow,
  attachments: WorkerDocumentSubmissionAttachment[],
): WorkerDocumentSubmission {
  if (!isWorkerSubmissionDocumentType(row.document_type)) {
    throw new WorkerDocumentSubmissionsServiceError(
      `Unsupported document type: ${row.document_type}`,
    )
  }

  const reviewStatus = row.review_status as WorkerSubmissionReviewStatus

  return {
    id: row.id,
    companyId: row.company_id,
    workerId: row.worker_id,
    documentType: row.document_type,
    customDocumentName: row.custom_document_name,
    referenceNumber: row.reference_number,
    notes: row.notes,
    reviewStatus,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at?.trim() || null,
    deletedBy: row.deleted_by?.trim() || null,
    deleteReason: row.delete_reason?.trim() || null,
    attachments: [...attachments].sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

async function fetchAttachmentsForSubmissions(
  submissionIds: string[],
): Promise<Map<string, WorkerDocumentSubmissionAttachment[]>> {
  const map = new Map<string, WorkerDocumentSubmissionAttachment[]>()
  if (submissionIds.length === 0) return map

  const { data, error } = await requireSupabase()
    .from('worker_document_submission_attachments')
    .select(
      'id, submission_id, file_path, original_file_name, mime_type, file_size_bytes, sort_order, created_at',
    )
    .in('submission_id', submissionIds)
    .order('sort_order', { ascending: true })

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.fetchAttachments',
    table: 'worker_document_submission_attachments',
    data,
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new WorkerDocumentSubmissionsServiceError(
        'Worker document submissions are not available yet. Run the worker document submissions migration on your Supabase project.',
      )
    }
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  for (const row of (data ?? []) as AttachmentRow[]) {
    const list = map.get(row.submission_id) ?? []
    list.push(mapAttachment(row))
    map.set(row.submission_id, list)
  }

  return map
}

async function queryCompanySubmissions(selectClause: string) {
  const companyId = requireVerifiedCompanyId()
  return requireSupabase()
    .from('worker_document_submissions')
    .select(selectClause)
    .eq('company_id', companyId)
    .order('submitted_at', { ascending: false })
}

async function loadMappedSubmissions(
  rows: SubmissionRow[],
): Promise<WorkerDocumentSubmission[]> {
  const attachmentsBySubmission = await fetchAttachmentsForSubmissions(
    rows.map((row) => row.id),
  )
  return rows.map((row) => mapSubmission(row, attachmentsBySubmission.get(row.id) ?? []))
}

export async function fetchMyWorkerDocumentSubmissions(): Promise<WorkerDocumentSubmission[]> {
  const companyId = requireVerifiedCompanyId()

  let selectClause = SUBMISSION_SELECT_WITH_LIFECYCLE
  let { data, error } = await requireSupabase()
    .from('worker_document_submissions')
    .select(selectClause)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('submitted_at', { ascending: false })

  if (error && isMissingLifecycleColumnError(error.message)) {
    selectClause = SUBMISSION_SELECT_BASE
    ;({ data, error } = await requireSupabase()
      .from('worker_document_submissions')
      .select(selectClause)
      .eq('company_id', companyId)
      .order('submitted_at', { ascending: false }))
  }

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.fetchMine',
    table: 'worker_document_submissions',
    data,
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      throw new WorkerDocumentSubmissionsServiceError(
        'Worker document submissions are not available yet. Run the worker document submissions migration on your Supabase project.',
      )
    }
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  return loadMappedSubmissions((data ?? []) as unknown as SubmissionRow[])
}

export async function fetchCompanyWorkerDocumentSubmissions(): Promise<
  WorkerDocumentSubmission[]
> {
  let selectClause = SUBMISSION_SELECT_WITH_LIFECYCLE
  let { data, error } = await queryCompanySubmissions(selectClause)

  if (error && isMissingLifecycleColumnError(error.message)) {
    selectClause = SUBMISSION_SELECT_BASE
    ;({ data, error } = await queryCompanySubmissions(selectClause))
  }

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.fetchCompany',
    table: 'worker_document_submissions',
    data,
    error,
  })

  if (error) {
    if (isMissingTableError(error.message)) {
      // Admin Documents merge stays resilient until migration is applied.
      return []
    }
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  return loadMappedSubmissions((data ?? []) as unknown as SubmissionRow[])
}

export async function createWorkerDocumentSubmission(
  workerId: string,
  input: CreateWorkerDocumentSubmissionInput,
): Promise<WorkerDocumentSubmission> {
  const companyId = requireVerifiedCompanyId()
  const trimmedWorkerId = workerId.trim()
  if (!trimmedWorkerId) {
    throw new WorkerDocumentSubmissionsServiceError('Worker profile is required.')
  }

  if (!isWorkerSubmissionDocumentType(input.documentType)) {
    throw new WorkerDocumentSubmissionsServiceError('Select a valid document type.')
  }

  const customName =
    input.documentType === 'Other' ? input.customDocumentName?.trim() || '' : null
  if (input.documentType === 'Other' && !customName) {
    throw new WorkerDocumentSubmissionsServiceError(
      'Enter a document name when type is Other.',
    )
  }

  const submissionId = crypto.randomUUID()
  let stagedPaths: string[] = []

  try {
    const staged = await uploadWorkerSubmissionFiles({
      companyId,
      workerId: trimmedWorkerId,
      submissionId,
      files: input.files,
    })
    stagedPaths = staged.map((item) => item.filePath)

    const { data, error } = await requireSupabase().rpc(
      'drevora_create_worker_document_submission',
      {
        p_submission_id: submissionId,
        p_company_id: companyId,
        p_document_type: input.documentType,
        p_custom_document_name: customName,
        p_reference_number: input.referenceNumber?.trim() || null,
        p_notes: input.notes?.trim() || null,
        p_attachments: staged.map((item) => ({
          id: item.id,
          file_path: item.filePath,
          original_file_name: item.originalFileName,
          mime_type: item.mimeType,
          file_size_bytes: item.fileSizeBytes,
          sort_order: item.sortOrder,
        })),
      },
    )

    logSupabaseQuery({
      service: 'workerDocumentSubmissionsService.create',
      table: 'rpc:drevora_create_worker_document_submission',
      data: data ? [data] : [],
      error,
    })

    if (error) {
      await cleanupWorkerSubmissionStagingFiles(stagedPaths)
      if (isMissingTableError(error.message) || error.message.includes('function')) {
        throw new WorkerDocumentSubmissionsServiceError(
          'Worker document submissions are not available yet. Run the worker document submissions migration on your Supabase project.',
        )
      }
      throw new WorkerDocumentSubmissionsServiceError(error.message)
    }

    const row = data as SubmissionRow
    return mapSubmission(
      row,
      staged.map((item) => ({
        id: item.id,
        submissionId,
        filePath: item.filePath,
        originalFileName: item.originalFileName,
        mimeType: item.mimeType,
        fileSizeBytes: item.fileSizeBytes,
        sortOrder: item.sortOrder,
        createdAt: row.created_at,
      })),
    )
  } catch (error) {
    if (stagedPaths.length > 0 && !(error instanceof WorkerDocumentSubmissionsServiceError)) {
      await cleanupWorkerSubmissionStagingFiles(stagedPaths)
    }
    if (
      error instanceof WorkerDocumentSubmissionsServiceError ||
      error instanceof WorkerDocumentSubmissionStorageError
    ) {
      throw error instanceof WorkerDocumentSubmissionsServiceError
        ? error
        : new WorkerDocumentSubmissionsServiceError(error.message)
    }
    throw error
  }
}

export async function reviewWorkerDocumentSubmission(input: {
  submissionId: string
  reviewStatus: 'reviewed' | 'rejected'
  rejectionReason?: string | null
}): Promise<WorkerDocumentSubmission> {
  const companyId = requireVerifiedCompanyId()
  const reason = input.rejectionReason?.trim() || null

  if (input.reviewStatus === 'rejected' && !reason) {
    throw new WorkerDocumentSubmissionsServiceError('A rejection reason is required.')
  }

  const { data, error } = await requireSupabase().rpc(
    'drevora_review_worker_document_submission',
    {
      p_submission_id: input.submissionId,
      p_company_id: companyId,
      p_review_status: input.reviewStatus,
      p_rejection_reason: input.reviewStatus === 'rejected' ? reason : null,
    },
  )

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.review',
    table: 'rpc:drevora_review_worker_document_submission',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  const row = data as SubmissionRow
  const attachments = await fetchAttachmentsForSubmissions([row.id])
  return mapSubmission(row, attachments.get(row.id) ?? [])
}

export async function updateWorkerDocumentSubmissionMetadata(input: {
  submissionId: string
  values: UpdateWorkerDocumentSubmissionMetadataInput
}): Promise<WorkerDocumentSubmission> {
  const companyId = requireVerifiedCompanyId()

  if (!isWorkerSubmissionDocumentType(input.values.documentType)) {
    throw new WorkerDocumentSubmissionsServiceError('Select a valid document type.')
  }

  const customName =
    input.values.documentType === 'Other'
      ? input.values.customDocumentName?.trim() || ''
      : null
  if (input.values.documentType === 'Other' && !customName) {
    throw new WorkerDocumentSubmissionsServiceError(
      'Enter a document name when type is Other.',
    )
  }

  const { data, error } = await requireSupabase().rpc(
    'drevora_update_worker_document_submission_metadata',
    {
      p_submission_id: input.submissionId,
      p_company_id: companyId,
      p_document_type: input.values.documentType,
      p_custom_document_name: customName,
      p_reference_number: input.values.referenceNumber?.trim() || null,
      p_notes: input.values.notes?.trim() || null,
    },
  )

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.updateMetadata',
    table: 'rpc:drevora_update_worker_document_submission_metadata',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  const row = data as SubmissionRow
  const attachments = await fetchAttachmentsForSubmissions([row.id])
  return mapSubmission(row, attachments.get(row.id) ?? [])
}

export async function softDeleteWorkerDocumentSubmission(input: {
  submissionId: string
  deleteReason?: string | null
}): Promise<WorkerDocumentSubmission> {
  const companyId = requireVerifiedCompanyId()

  const { data, error } = await requireSupabase().rpc(
    'drevora_soft_delete_worker_document_submission',
    {
      p_submission_id: input.submissionId,
      p_company_id: companyId,
      p_delete_reason: input.deleteReason?.trim() || null,
    },
  )

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.softDelete',
    table: 'rpc:drevora_soft_delete_worker_document_submission',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  const row = data as SubmissionRow
  const attachments = await fetchAttachmentsForSubmissions([row.id])
  return mapSubmission(row, attachments.get(row.id) ?? [])
}

export async function restoreWorkerDocumentSubmission(
  submissionId: string,
): Promise<WorkerDocumentSubmission> {
  const companyId = requireVerifiedCompanyId()

  const { data, error } = await requireSupabase().rpc(
    'drevora_restore_worker_document_submission',
    {
      p_submission_id: submissionId,
      p_company_id: companyId,
    },
  )

  logSupabaseQuery({
    service: 'workerDocumentSubmissionsService.restore',
    table: 'rpc:drevora_restore_worker_document_submission',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new WorkerDocumentSubmissionsServiceError(error.message)
  }

  const row = data as SubmissionRow
  const attachments = await fetchAttachmentsForSubmissions([row.id])
  return mapSubmission(row, attachments.get(row.id) ?? [])
}

export function workerSubmissionListLabel(
  submission: Pick<WorkerDocumentSubmission, 'documentType' | 'customDocumentName'>,
): string {
  return getWorkerSubmissionDisplayName(submission)
}

export type { WorkerSubmissionDocumentType }
