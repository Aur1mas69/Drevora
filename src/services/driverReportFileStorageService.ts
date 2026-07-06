import {
  buildDriverReportFilePath,
  DRIVER_REPORT_FILES_BUCKET,
  isExternalDriverReportUrl,
  validateDriverReportFile,
} from '@/lib/driverReportFileStorage'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

const SIGNED_URL_EXPIRY_SECONDS = 3600

export class DriverReportFileStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DriverReportFileStorageError'
  }
}

function resolveBucketAndPath(storagePathOrUrl: string): { bucket: string; path: string } | null {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed || isExternalDriverReportUrl(trimmed)) return null

  if (trimmed.startsWith(`${DRIVER_REPORT_FILES_BUCKET}/`)) {
    return {
      bucket: DRIVER_REPORT_FILES_BUCKET,
      path: trimmed.slice(DRIVER_REPORT_FILES_BUCKET.length + 1),
    }
  }

  return { bucket: DRIVER_REPORT_FILES_BUCKET, path: trimmed }
}

export async function uploadDriverReportFile(
  companyId: string,
  reportId: string,
  file: File,
): Promise<string> {
  const validationError = validateDriverReportFile(file)
  if (validationError) throw new DriverReportFileStorageError(validationError)

  const storagePath = buildDriverReportFilePath(companyId, reportId, file.name)

  const { error } = await requireSupabase()
    .storage.from(DRIVER_REPORT_FILES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  logSupabaseQuery({
    service: 'driverReportFileStorageService.uploadDriverReportFile',
    table: `storage:${DRIVER_REPORT_FILES_BUCKET}`,
    data: [{ path: storagePath }],
    error,
  })

  if (error) throw new DriverReportFileStorageError(error.message)
  return storagePath
}

export async function deleteDriverReportFile(
  storagePathOrUrl: string | null | undefined,
): Promise<void> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed || isExternalDriverReportUrl(trimmed)) return

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return

  const { error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .remove([resolved.path])

  if (error) throw new DriverReportFileStorageError(error.message)
}

export async function getDriverReportFileSignedUrl(
  storagePathOrUrl: string | null | undefined,
): Promise<string | null> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed) return null
  if (isExternalDriverReportUrl(trimmed)) return trimmed

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return null

  const { data, error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .createSignedUrl(resolved.path, SIGNED_URL_EXPIRY_SECONDS)

  if (error) throw new DriverReportFileStorageError(error.message)
  return data?.signedUrl ?? null
}

export async function applyDriverReportFileChanges(input: {
  companyId: string
  reportId: string
  existingFilePath: string | null
  file: File | null
  removeFile: boolean
}): Promise<string | null> {
  if (input.removeFile) {
    if (input.existingFilePath) {
      try {
        await deleteDriverReportFile(input.existingFilePath)
      } catch {
        /* continue */
      }
    }
    return null
  }

  if (input.file) {
    if (input.existingFilePath) {
      try {
        await deleteDriverReportFile(input.existingFilePath)
      } catch {
        /* continue */
      }
    }
    return uploadDriverReportFile(input.companyId, input.reportId, input.file)
  }

  return input.existingFilePath
}
