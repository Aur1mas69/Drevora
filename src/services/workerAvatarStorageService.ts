import {
  buildWorkerAvatarPath,
  isExternalAvatarUrl,
  isWorkerAvatarStoragePath,
  validateWorkerAvatarFile,
  WORKER_AVATARS_BUCKET,
} from '@/lib/workerAvatarStorage'
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

  if (trimmed.startsWith(`${WORKER_AVATARS_BUCKET}/`)) {
    return {
      bucket: WORKER_AVATARS_BUCKET,
      path: trimmed.slice(WORKER_AVATARS_BUCKET.length + 1),
    }
  }

  return {
    bucket: WORKER_AVATARS_BUCKET,
    path: trimmed,
  }
}

export function getWorkerAvatarPublicUrl(storagePathOrUrl: string): string {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) return ''
  if (isExternalAvatarUrl(trimmed)) return trimmed

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return trimmed

  const { data } = requireSupabase()
    .storage.from(resolved.bucket)
    .getPublicUrl(resolved.path)

  return data.publicUrl
}

export async function uploadWorkerAvatar(
  company: string | null | undefined,
  workerId: string,
  file: File,
): Promise<string> {
  const validationError = validateWorkerAvatarFile(file)
  if (validationError) {
    throw new WorkerAvatarStorageError(validationError)
  }

  const mimeType = file.type.trim().toLowerCase() || 'image/jpeg'
  const storagePath = buildWorkerAvatarPath(company, workerId, file.name, mimeType)

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

export async function deleteWorkerAvatar(
  storagePathOrUrl: string | null | undefined,
): Promise<void> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed || isExternalAvatarUrl(trimmed)) return

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return

  const { error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .remove([resolved.path])

  logSupabaseQuery({
    service: 'workerAvatarStorageService.deleteWorkerAvatar',
    table: `storage:${resolved.bucket}`,
    data: [{ path: resolved.path }],
    error,
  })

  if (error) {
    throw new WorkerAvatarStorageError(error.message)
  }
}

export async function applyWorkerAvatarChanges(input: {
  company: string | null | undefined
  workerId: string
  existingAvatarUrl: string | null | undefined
  avatarFile: File | null
  removeAvatar: boolean
}): Promise<string | null> {
  const existingPath = input.existingAvatarUrl?.trim() || null

  if (input.removeAvatar) {
    if (existingPath && isWorkerAvatarStoragePath(existingPath)) {
      try {
        await deleteWorkerAvatar(existingPath)
      } catch {
        /* clear DB even if storage delete fails */
      }
    }
    return null
  }

  if (input.avatarFile) {
    const nextPath = await uploadWorkerAvatar(
      input.company,
      input.workerId,
      input.avatarFile,
    )

    if (
      existingPath &&
      existingPath !== nextPath &&
      isWorkerAvatarStoragePath(existingPath)
    ) {
      try {
        await deleteWorkerAvatar(existingPath)
      } catch {
        /* keep new upload even if old file cleanup fails */
      }
    }

    return nextPath
  }

  return existingPath
}

export async function saveWorkerAvatarForDriver(
  worker: Driver,
  avatarFile: File | null,
  removeAvatar: boolean,
): Promise<Driver> {
  if (!avatarFile && !removeAvatar) {
    return worker
  }

  const nextAvatarUrl = await applyWorkerAvatarChanges({
    company: worker.company,
    workerId: worker.id,
    existingAvatarUrl: worker.avatarUrl,
    avatarFile,
    removeAvatar,
  })

  return driversService.updateWorkerAvatarUrl(worker.id, nextAvatarUrl)
}
