import {
  SUPPORT_ACCEPTED_IMAGE_TYPES,
  SUPPORT_MAX_ATTACHMENT_BYTES,
  SUPPORT_MAX_ATTACHMENTS,
} from '@/lib/supportRequestTypes'
import { requireSupabase } from '@/lib/supabase'

export const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments'

export class SupportAttachmentsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportAttachmentsServiceError'
  }
}

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export function validateSupportScreenshotFiles(files: File[]): string | null {
  if (files.length > SUPPORT_MAX_ATTACHMENTS) {
    return `You can attach up to ${SUPPORT_MAX_ATTACHMENTS} screenshots.`
  }
  for (const file of files) {
    if (
      !SUPPORT_ACCEPTED_IMAGE_TYPES.includes(
        file.type as (typeof SUPPORT_ACCEPTED_IMAGE_TYPES)[number],
      )
    ) {
      return 'Screenshots must be JPEG, PNG, or WebP images.'
    }
    if (file.size <= 0 || file.size > SUPPORT_MAX_ATTACHMENT_BYTES) {
      return 'Each screenshot must be 5 MB or smaller.'
    }
  }
  return null
}

export function buildSupportAttachmentPath(
  companyId: string,
  driverId: string,
  requestId: string,
  file: File,
): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${companyId}/${driverId}/${requestId}/${uuid}.${extensionForMime(file.type)}`
}

export async function uploadSupportAttachments(input: {
  companyId: string
  driverId: string
  requestId: string
  files: File[]
}): Promise<string[]> {
  const validationError = validateSupportScreenshotFiles(input.files)
  if (validationError) {
    throw new SupportAttachmentsServiceError(validationError)
  }
  if (input.files.length === 0) return []

  const supabase = requireSupabase()
  const uploaded: string[] = []

  try {
    for (const file of input.files) {
      const path = buildSupportAttachmentPath(
        input.companyId,
        input.driverId,
        input.requestId,
        file,
      )
      const { error } = await supabase.storage
        .from(SUPPORT_ATTACHMENTS_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })
      if (error) {
        throw new SupportAttachmentsServiceError(
          'Unable to upload screenshots. Please try again.',
        )
      }
      uploaded.push(path)
    }
    return uploaded
  } catch (error) {
    await deleteSupportAttachments(uploaded)
    if (error instanceof SupportAttachmentsServiceError) throw error
    throw new SupportAttachmentsServiceError(
      'Unable to upload screenshots. Please try again.',
    )
  }
}

export async function deleteSupportAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await requireSupabase().storage.from(SUPPORT_ATTACHMENTS_BUCKET).remove(paths)
  } catch {
    // Best-effort cleanup only.
  }
}

export async function createSupportAttachmentSignedUrl(
  path: string,
): Promise<string | null> {
  const { data, error } = await requireSupabase()
    .storage.from(SUPPORT_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 10)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
