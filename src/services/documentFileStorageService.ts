import {
  buildDocumentFilePath,
  DOCUMENT_FILES_BUCKET,
  isExternalDocumentUrl,
  validateDocumentFile,
} from '@/lib/documentFileStorage'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

const SIGNED_URL_EXPIRY_SECONDS = 3600

export class DocumentFileStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentFileStorageError'
  }
}

function resolveBucketAndPath(storagePathOrUrl: string): { bucket: string; path: string } | null {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed || isExternalDocumentUrl(trimmed)) return null

  if (trimmed.startsWith(`${DOCUMENT_FILES_BUCKET}/`)) {
    return {
      bucket: DOCUMENT_FILES_BUCKET,
      path: trimmed.slice(DOCUMENT_FILES_BUCKET.length + 1),
    }
  }

  return {
    bucket: DOCUMENT_FILES_BUCKET,
    path: trimmed,
  }
}

export async function uploadDocumentFile(
  companyId: string,
  documentId: string,
  file: File,
): Promise<string> {
  const validationError = validateDocumentFile(file)
  if (validationError) {
    throw new DocumentFileStorageError(validationError)
  }

  const storagePath = buildDocumentFilePath(companyId, documentId, file.name)

  const { error } = await requireSupabase()
    .storage.from(DOCUMENT_FILES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  logSupabaseQuery({
    service: 'documentFileStorageService.uploadDocumentFile',
    table: `storage:${DOCUMENT_FILES_BUCKET}`,
    data: [{ path: storagePath }],
    error,
  })

  if (error) {
    throw new DocumentFileStorageError(error.message)
  }

  return storagePath
}

export async function deleteDocumentFile(storagePathOrUrl: string | null | undefined): Promise<void> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed || isExternalDocumentUrl(trimmed)) return

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return

  const { error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .remove([resolved.path])

  logSupabaseQuery({
    service: 'documentFileStorageService.deleteDocumentFile',
    table: `storage:${DOCUMENT_FILES_BUCKET}`,
    data: [],
    error,
  })

  if (error) {
    throw new DocumentFileStorageError(error.message)
  }
}

export async function getDocumentFileSignedUrl(
  storagePathOrUrl: string | null | undefined,
): Promise<string | null> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed) return null
  if (isExternalDocumentUrl(trimmed)) return trimmed

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return null

  const { data, error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .createSignedUrl(resolved.path, SIGNED_URL_EXPIRY_SECONDS)

  logSupabaseQuery({
    service: 'documentFileStorageService.getDocumentFileSignedUrl',
    table: `storage:${DOCUMENT_FILES_BUCKET}`,
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw new DocumentFileStorageError(error.message)
  }

  return data?.signedUrl ?? null
}

export async function applyDocumentFileChanges(input: {
  companyId: string
  documentId: string
  existingFilePath: string | null
  file: File | null
  removeFile: boolean
}): Promise<string | null> {
  if (input.removeFile) {
    if (input.existingFilePath) {
      try {
        await deleteDocumentFile(input.existingFilePath)
      } catch {
        /* clear DB even if storage delete fails */
      }
    }
    return null
  }

  if (input.file) {
    if (input.existingFilePath) {
      try {
        await deleteDocumentFile(input.existingFilePath)
      } catch {
        /* continue with new upload */
      }
    }
    return uploadDocumentFile(input.companyId, input.documentId, input.file)
  }

  return input.existingFilePath
}
