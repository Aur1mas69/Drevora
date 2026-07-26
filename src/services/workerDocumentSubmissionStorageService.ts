import { sanitizeDocumentFileName } from '@/lib/documentFileStorage'
import {
  buildWorkerSubmissionFilePath,
  DOCUMENT_FILES_BUCKET,
  resolveWorkerSubmissionMimeType,
  validateWorkerSubmissionFiles,
} from '@/lib/workerDocumentSubmissionStorage'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

/** Short-lived private signed URL lifetime (1 hour). */
export const WORKER_SUBMISSION_SIGNED_URL_EXPIRY_SECONDS = 3600
const SIGNED_URL_EXPIRY_SECONDS = WORKER_SUBMISSION_SIGNED_URL_EXPIRY_SECONDS

export class WorkerDocumentSubmissionStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerDocumentSubmissionStorageError'
  }
}

export type StagedWorkerSubmissionUpload = {
  id: string
  filePath: string
  originalFileName: string
  mimeType: string
  fileSizeBytes: number
  sortOrder: number
}

export async function uploadWorkerSubmissionFiles(input: {
  companyId: string
  workerId: string
  submissionId: string
  files: File[]
}): Promise<StagedWorkerSubmissionUpload[]> {
  const validationError = validateWorkerSubmissionFiles(input.files)
  if (validationError) {
    throw new WorkerDocumentSubmissionStorageError(validationError)
  }

  const staged: StagedWorkerSubmissionUpload[] = []
  const uploadedPaths: string[] = []

  try {
    for (let index = 0; index < input.files.length; index += 1) {
      const file = input.files[index]
      const mimeType = resolveWorkerSubmissionMimeType(file)
      if (!mimeType) {
        throw new WorkerDocumentSubmissionStorageError(
          `"${file.name}" is not a supported file type.`,
        )
      }

      const attachmentId = crypto.randomUUID()
      const filePath = buildWorkerSubmissionFilePath({
        companyId: input.companyId,
        workerId: input.workerId,
        submissionId: input.submissionId,
        attachmentId,
        fileName: file.name,
      })

      const { error } = await requireSupabase()
        .storage.from(DOCUMENT_FILES_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeType,
        })

      logSupabaseQuery({
        service: 'workerDocumentSubmissionStorageService.upload',
        table: `storage:${DOCUMENT_FILES_BUCKET}`,
        data: [{ path: filePath }],
        error,
      })

      if (error) {
        throw new WorkerDocumentSubmissionStorageError(error.message)
      }

      uploadedPaths.push(filePath)
      staged.push({
        id: attachmentId,
        filePath,
        originalFileName: file.name,
        mimeType,
        fileSizeBytes: file.size,
        sortOrder: index + 1,
      })
    }

    return staged
  } catch (error) {
    await cleanupWorkerSubmissionStagingFiles(uploadedPaths)
    throw error
  }
}

/** Compensation cleanup for staging objects not yet linked as attachments. */
export async function cleanupWorkerSubmissionStagingFiles(
  filePaths: string[],
): Promise<void> {
  const paths = [...new Set(filePaths.map((path) => path.trim()).filter(Boolean))]
  if (paths.length === 0) return

  const { error } = await requireSupabase()
    .storage.from(DOCUMENT_FILES_BUCKET)
    .remove(paths)

  logSupabaseQuery({
    service: 'workerDocumentSubmissionStorageService.cleanup',
    table: `storage:${DOCUMENT_FILES_BUCKET}`,
    data: paths.map((path) => ({ path })),
    error,
  })
}

export async function getWorkerSubmissionFileSignedUrl(
  storagePath: string | null | undefined,
  options?: { downloadFileName?: string | boolean },
): Promise<string | null> {
  const trimmed = storagePath?.trim()
  if (!trimmed) return null

  const downloadOption =
    options?.downloadFileName === undefined
      ? undefined
      : options.downloadFileName === true
        ? true
        : sanitizeDocumentFileName(String(options.downloadFileName))

  const { data, error } = await requireSupabase()
    .storage.from(DOCUMENT_FILES_BUCKET)
    .createSignedUrl(
      trimmed,
      SIGNED_URL_EXPIRY_SECONDS,
      downloadOption !== undefined ? { download: downloadOption } : undefined,
    )

  logSupabaseQuery({
    service: 'workerDocumentSubmissionStorageService.signedUrl',
    table: `storage:${DOCUMENT_FILES_BUCKET}`,
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new WorkerDocumentSubmissionStorageError(error.message)
  }

  return data?.signedUrl ?? null
}

/**
 * Downloads a private Worker submission attachment via a short-lived signed URL
 * with Content-Disposition download, using a safe original file name.
 */
export async function downloadWorkerSubmissionFile(
  storagePath: string | null | undefined,
  originalFileName: string,
): Promise<void> {
  const safeName = sanitizeDocumentFileName(originalFileName)
  const url = await getWorkerSubmissionFileSignedUrl(storagePath, {
    downloadFileName: safeName,
  })
  if (!url) {
    throw new WorkerDocumentSubmissionStorageError('Unable to create download link.')
  }

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.rel = 'noopener'
  anchor.download = safeName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
