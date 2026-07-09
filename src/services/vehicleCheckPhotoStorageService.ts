import {
  buildVehicleCheckDefectPhotoPath,
  buildVehicleCheckSignaturePath,
  isExternalVehicleCheckPhotoUrl,
  isVehicleCheckPhotoStoragePath,
  validateVehicleCheckPhotoFile,
  VEHICLE_CHECK_PHOTOS_BUCKET,
} from '@/lib/vehicleCheckPhotoStorage'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

const SIGNED_URL_EXPIRY_SECONDS = 3600

export class VehicleCheckPhotoStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleCheckPhotoStorageError'
  }
}

function resolveBucketAndPath(storagePathOrUrl: string): { bucket: string; path: string } | null {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed || isExternalVehicleCheckPhotoUrl(trimmed)) return null

  if (trimmed.startsWith(`${VEHICLE_CHECK_PHOTOS_BUCKET}/`)) {
    return {
      bucket: VEHICLE_CHECK_PHOTOS_BUCKET,
      path: trimmed.slice(VEHICLE_CHECK_PHOTOS_BUCKET.length + 1),
    }
  }

  return {
    bucket: VEHICLE_CHECK_PHOTOS_BUCKET,
    path: trimmed,
  }
}

export async function uploadVehicleCheckDefectPhoto(
  vehicleId: string,
  checkId: string,
  category: string,
  itemName: string,
  file: File,
): Promise<string> {
  const validationError = validateVehicleCheckPhotoFile(file)
  if (validationError) {
    throw new VehicleCheckPhotoStorageError(validationError)
  }

  const storagePath = buildVehicleCheckDefectPhotoPath(
    vehicleId,
    checkId,
    category,
    itemName,
    file.name,
  )

  const { error } = await requireSupabase()
    .storage.from(VEHICLE_CHECK_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  logSupabaseQuery({
    service: 'vehicleCheckPhotoStorageService.uploadVehicleCheckDefectPhoto',
    table: `storage:${VEHICLE_CHECK_PHOTOS_BUCKET}`,
    data: [{ path: storagePath }],
    error,
  })

  if (error) {
    throw new VehicleCheckPhotoStorageError(
      error.message === 'Bucket not found'
        ? 'Vehicle check storage is not configured. Ask an admin to run supabase/scripts/apply_vehicle_check_storage_bucket.sql in Supabase.'
        : error.message,
    )
  }

  return storagePath
}

export async function uploadVehicleCheckSignature(
  vehicleId: string,
  checkId: string,
  file: File,
): Promise<string> {
  const validationError = validateVehicleCheckPhotoFile(file)
  if (validationError) {
    throw new VehicleCheckPhotoStorageError(validationError)
  }

  const storagePath = buildVehicleCheckSignaturePath(vehicleId, checkId)

  const { error } = await requireSupabase()
    .storage.from(VEHICLE_CHECK_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })

  logSupabaseQuery({
    service: 'vehicleCheckPhotoStorageService.uploadVehicleCheckSignature',
    table: `storage:${VEHICLE_CHECK_PHOTOS_BUCKET}`,
    data: [{ path: storagePath }],
    error,
  })

  if (error) {
    throw new VehicleCheckPhotoStorageError(
      error.message === 'Bucket not found'
        ? 'Vehicle check storage is not configured. Ask an admin to run supabase/scripts/apply_vehicle_check_storage_bucket.sql in Supabase.'
        : error.message,
    )
  }

  return storagePath
}

export async function deleteVehicleCheckPhoto(
  storagePathOrUrl: string | null | undefined,
): Promise<void> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed || isExternalVehicleCheckPhotoUrl(trimmed)) return

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return

  const { error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .remove([resolved.path])

  logSupabaseQuery({
    service: 'vehicleCheckPhotoStorageService.deleteVehicleCheckPhoto',
    table: `storage:${resolved.bucket}`,
    data: [{ path: resolved.path }],
    error,
  })

  if (error) {
    throw new VehicleCheckPhotoStorageError(error.message)
  }
}

export async function getVehicleCheckPhotoSignedUrl(
  storagePathOrUrl: string,
  expiresIn = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) {
    throw new VehicleCheckPhotoStorageError('Photo is not available.')
  }

  if (isExternalVehicleCheckPhotoUrl(trimmed)) {
    return trimmed
  }

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) {
    throw new VehicleCheckPhotoStorageError('Photo path is invalid.')
  }

  const { data, error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .createSignedUrl(resolved.path, expiresIn)

  logSupabaseQuery({
    service: 'vehicleCheckPhotoStorageService.getVehicleCheckPhotoSignedUrl',
    table: `storage:${resolved.bucket}`,
    data: data ? [{ path: resolved.path }] : [],
    error,
  })

  if (error || !data?.signedUrl) {
    throw new VehicleCheckPhotoStorageError(error?.message ?? 'Unable to open photo.')
  }

  return data.signedUrl
}

export function isStoredVehicleCheckPhoto(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && isVehicleCheckPhotoStoragePath(value!)
}
