import {
  buildConsumableReceiptPath,
  CONSUMABLE_RECEIPTS_BUCKET,
  isConsumableReceiptStoragePath,
  isExternalReceiptUrl,
  validateConsumableReceiptFile,
} from '@/lib/consumableReceiptStorage'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'

const SIGNED_URL_EXPIRY_SECONDS = 3600

export class ConsumableReceiptStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConsumableReceiptStorageError'
  }
}

function resolveBucketAndPath(storagePathOrUrl: string): { bucket: string; path: string } | null {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed || isExternalReceiptUrl(trimmed)) return null

  if (trimmed.startsWith(`${CONSUMABLE_RECEIPTS_BUCKET}/`)) {
    return {
      bucket: CONSUMABLE_RECEIPTS_BUCKET,
      path: trimmed.slice(CONSUMABLE_RECEIPTS_BUCKET.length + 1),
    }
  }

  return {
    bucket: CONSUMABLE_RECEIPTS_BUCKET,
    path: trimmed,
  }
}

export async function uploadConsumableReceipt(
  companyId: string,
  consumableId: string,
  file: File,
): Promise<string> {
  const validationError = validateConsumableReceiptFile(file)
  if (validationError) {
    throw new ConsumableReceiptStorageError(validationError)
  }

  const storagePath = buildConsumableReceiptPath(companyId, consumableId, file.name)

  const { error } = await requireSupabase()
    .storage.from(CONSUMABLE_RECEIPTS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  logSupabaseQuery({
    service: 'consumableReceiptStorageService.uploadConsumableReceipt',
    table: `storage:${CONSUMABLE_RECEIPTS_BUCKET}`,
    data: [{ path: storagePath }],
    error,
  })

  if (error) {
    throw new ConsumableReceiptStorageError(error.message)
  }

  return storagePath
}

export async function deleteConsumableReceipt(storagePathOrUrl: string | null | undefined): Promise<void> {
  const trimmed = storagePathOrUrl?.trim()
  if (!trimmed || isExternalReceiptUrl(trimmed)) return

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) return

  const { error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .remove([resolved.path])

  logSupabaseQuery({
    service: 'consumableReceiptStorageService.deleteConsumableReceipt',
    table: `storage:${resolved.bucket}`,
    data: [{ path: resolved.path }],
    error,
  })

  if (error) {
    throw new ConsumableReceiptStorageError(error.message)
  }
}

export async function getConsumableReceiptSignedUrl(
  storagePathOrUrl: string,
  expiresIn = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string> {
  const trimmed = storagePathOrUrl.trim()
  if (!trimmed) {
    throw new ConsumableReceiptStorageError('Receipt is not available.')
  }

  if (isExternalReceiptUrl(trimmed)) {
    return trimmed
  }

  const resolved = resolveBucketAndPath(trimmed)
  if (!resolved) {
    throw new ConsumableReceiptStorageError('Receipt path is invalid.')
  }

  const { data, error } = await requireSupabase()
    .storage.from(resolved.bucket)
    .createSignedUrl(resolved.path, expiresIn)

  logSupabaseQuery({
    service: 'consumableReceiptStorageService.getConsumableReceiptSignedUrl',
    table: `storage:${resolved.bucket}`,
    data: data ? [{ path: resolved.path }] : [],
    error,
  })

  if (error || !data?.signedUrl) {
    throw new ConsumableReceiptStorageError(error?.message ?? 'Unable to open receipt.')
  }

  return data.signedUrl
}

export async function openConsumableReceipt(storagePathOrUrl: string): Promise<void> {
  const url = await getConsumableReceiptSignedUrl(storagePathOrUrl)
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function isStoredConsumableReceipt(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && isConsumableReceiptStoragePath(value!)
}

export async function applyConsumableReceiptChanges(input: {
  companyId: string
  consumableId: string
  existingReceiptPath: string | null | undefined
  receiptFile: File | null
  removeReceipt: boolean
}): Promise<string | null> {
  const existingPath = input.existingReceiptPath?.trim() || null

  if (input.removeReceipt) {
    if (existingPath) {
      await deleteConsumableReceipt(existingPath)
    }
    return null
  }

  if (input.receiptFile) {
    const nextPath = await uploadConsumableReceipt(
      input.companyId,
      input.consumableId,
      input.receiptFile,
    )

    if (existingPath && existingPath !== nextPath) {
      try {
        await deleteConsumableReceipt(existingPath)
      } catch {
        /* keep new upload even if old file cleanup fails */
      }
    }

    return nextPath
  }

  return existingPath
}
