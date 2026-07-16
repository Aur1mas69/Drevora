import {
  buildWorkerAvatarPath,
  canSafelyDeleteWorkerAvatarPath,
  isExternalAvatarUrl,
  isWorkerAvatarStoragePath,
  validateWorkerAvatarFile,
  WORKER_AVATAR_SIGNED_URL_EXPIRY_SECONDS,
  WORKER_AVATARS_BUCKET,
} from '@/lib/workerAvatarStorage'
import {
  MissingCompanyContextError,
  requireVerifiedCompanyId,
} from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import type { Driver } from '@/services/driversService'
import { driversService } from '@/services/driversService'

export class WorkerAvatarStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkerAvatarStorageError'
  }
}

function resolveBucketAndPath(storagePathOrUrl: string): { bucket: string; path: string } | null {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed || isExternalAvatarUrl(trimmed)) return null

  // Legacy values may prefix the bucket id; strip only when it is the first segment.
  if (trimmed.startsWith(`${WORKER_AVATARS_BUCKET}/`)) {
    const remainder = trimmed.slice(WORKER_AVATARS_BUCKET.length + 1)
    // Do not strip when the path is already canonical: `{uuid}/worker-avatars/...`
    // (first segment is a UUID, not the bucket name).
    if (remainder.length > 0) {
      return {
        bucket: WORKER_AVATARS_BUCKET,
        path: remainder,
      }
    }
  }

  return {
    bucket: WORKER_AVATARS_BUCKET,
    path: trimmed,
  }
}

/**
 * Resolve a display URL for a Worker avatar at render time.
 * - Storage object paths → short-lived signed URL (never persisted).
 * - Absolute http(s) / blob: / data: URLs → returned as-is for compatibility.
 * - Missing/invalid → null (caller shows initials).
 */
export async function getWorkerAvatarSignedUrl(
  storagePathOrUrl: string | null | undefined,
  expiresIn = WORKER_AVATAR_SIGNED_URL_EXPIRY_SECONDS,
): Promise<string | null> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed) return null

  if (isExternalAvatarUrl(trimmed)) {
    return trimmed
  }

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return null

  const { data, error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .createSignedUrl(resolved.path, expiresIn)

  logSupabaseQuery({
    service: 'workerAvatarStorageService.getWorkerAvatarSignedUrl',
    table: `storage:${resolved.bucket}`,
    data: data ? [{ path: resolved.path }] : [],
    error,
  })

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}

export async function uploadWorkerAvatar(
  companyId: string,
  workerId: string,
  file: File,
): Promise<string> {
  const validationError = validateWorkerAvatarFile(file)
  if (validationError) {
    throw new WorkerAvatarStorageError(validationError)
  }

  let verifiedCompanyId: string
  try {
    verifiedCompanyId = requireVerifiedCompanyId()
  } catch (error) {
    if (error instanceof MissingCompanyContextError) {
      throw new WorkerAvatarStorageError(error.message)
    }
    throw error
  }

  if (!companyId.trim() || companyId.trim() !== verifiedCompanyId) {
    throw new WorkerAvatarStorageError(
      'Avatar upload requires the verified company id for your session.',
    )
  }

  const mimeType = file.type.trim().toLowerCase() || 'image/jpeg'

  let storagePath: string
  try {
    storagePath = buildWorkerAvatarPath(
      verifiedCompanyId,
      workerId,
      file.name,
      mimeType,
    )
  } catch (error) {
    throw new WorkerAvatarStorageError(
      error instanceof Error
        ? error.message
        : 'Unable to build a safe worker avatar storage path.',
    )
  }

  const { error } = await requireSupabase()
    .storage.from(WORKER_AVATARS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: mimeType,
    })

  logSupabaseQuery({
    service: 'workerAvatarStorageService.uploadWorkerAvatar',
    table: `storage:${WORKER_AVATARS_BUCKET}`,
    data: [{ path: storagePath }],
    error,
  })

  if (error) {
    throw new WorkerAvatarStorageError(error.message)
  }

  return storagePath
}

/**
 * Delete a Storage object only when the path is the canonical UUID-first layout
 * and matches the verified company + worker. Legacy slug paths are left in place.
 */
export async function deleteWorkerAvatarIfSafe(
  storagePathOrUrl: string | null | undefined,
  verifiedCompanyId: string,
  workerId: string,
): Promise<void> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed || isExternalAvatarUrl(trimmed)) return

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return

  if (!canSafelyDeleteWorkerAvatarPath(resolved.path, verifiedCompanyId, workerId)) {
    // Legacy slug paths (or mismatched tenant/worker) are not deleted here.
    // Controlled backfill will clean orphaned objects later.
    return
  }

  const { error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .remove([resolved.path])

  logSupabaseQuery({
    service: 'workerAvatarStorageService.deleteWorkerAvatarIfSafe',
    table: `storage:${resolved.bucket}`,
    data: [{ path: resolved.path }],
    error,
  })

  if (error) {
    throw new WorkerAvatarStorageError(error.message)
  }
}

export async function saveWorkerAvatarForDriver(
  worker: Driver,
  avatarFile: File | null,
  removeAvatar: boolean,
): Promise<Driver> {
  if (!avatarFile && !removeAvatar) {
    return worker
  }

  let verifiedCompanyId: string
  try {
    verifiedCompanyId = requireVerifiedCompanyId()
  } catch (error) {
    if (error instanceof MissingCompanyContextError) {
      throw new WorkerAvatarStorageError(error.message)
    }
    throw error
  }

  const existingPath = worker.avatarUrl?.trim() || null

  if (removeAvatar) {
    const updated = await driversService.updateWorkerAvatarUrl(worker.id, null)
    if (existingPath && isWorkerAvatarStoragePath(existingPath)) {
      try {
        await deleteWorkerAvatarIfSafe(existingPath, verifiedCompanyId, worker.id)
      } catch {
        /* DB already cleared; leave Storage cleanup for later if delete fails */
      }
    }
    return updated
  }

  if (avatarFile) {
    // 1) Upload to canonical path
    const nextPath = await uploadWorkerAvatar(
      verifiedCompanyId,
      worker.id,
      avatarFile,
    )

    // 2) Persist object path only (never a signed URL)
    const updated = await driversService.updateWorkerAvatarUrl(worker.id, nextPath)

    // 3) Delete previous object only when path ownership is verified
    if (
      existingPath &&
      existingPath !== nextPath &&
      isWorkerAvatarStoragePath(existingPath)
    ) {
      try {
        await deleteWorkerAvatarIfSafe(existingPath, verifiedCompanyId, worker.id)
      } catch {
        /* keep new path even if old file cleanup fails */
      }
    }

    return updated
  }

  return worker
}
