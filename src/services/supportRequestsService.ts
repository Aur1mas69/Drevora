import { APP_VERSION } from '@/lib/appVersion'
import { requireVerifiedCompanyId } from '@/lib/companySettingsGlobals'
import {
  collectMinimalSupportDeviceMetadata,
  collectSupportDeviceMetadata,
} from '@/lib/supportDeviceMetadata'
import type {
  BugCategory,
  FeedbackType,
  SupportDeviceMetadata,
  SupportMinimalDeviceMetadata,
  SupportNetworkState,
  SupportPlatform,
  SupportRequest,
  SupportRequestListFilter,
  SupportRequestStatus,
  SupportRequestType,
} from '@/lib/supportRequestTypes'
import {
  normalizeSupportStatus,
  RATING_CATEGORY,
  validateFeedbackComment,
  validateSupportDescription,
  validateSupportSteps,
  validateSupportTitle,
} from '@/lib/supportRequestTypes'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  deleteSupportAttachments,
  uploadSupportAttachments,
  validateSupportScreenshotFiles,
} from '@/services/supportAttachmentsService'

type SupportRequestRow = {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  driver_id: string
  request_type: string
  category: string
  title: string
  description: string
  steps_to_reproduce: string | null
  rating: number | null
  status: string
  support_response: string | null
  responded_at: string | null
  resolved_at: string | null
  reference: string
  app_version: string
  platform: string
  route: string | null
  network_state: string
  device_metadata: unknown
  attachment_paths: string[] | null
}

const supportRequestSelect = `
  id,
  created_at,
  updated_at,
  company_id,
  driver_id,
  request_type,
  category,
  title,
  description,
  steps_to_reproduce,
  rating,
  status,
  support_response,
  responded_at,
  resolved_at,
  reference,
  app_version,
  platform,
  route,
  network_state,
  device_metadata,
  attachment_paths
`

export class SupportRequestsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupportRequestsServiceError'
  }
}

function friendlyError(error: unknown, fallback: string): SupportRequestsServiceError {
  if (error instanceof SupportRequestsServiceError) return error
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : ''
  if (/relation .*support_requests.* does not exist/i.test(message)) {
    return new SupportRequestsServiceError(
      'Support requests are not available yet. Please ask your Office to apply the latest DREVORA update.',
    )
  }
  if (/JWT|auth|permission|policy|RLS/i.test(message)) {
    return new SupportRequestsServiceError(
      'You do not have permission to manage this support request.',
    )
  }
  return new SupportRequestsServiceError(fallback)
}

function mapRow(row: SupportRequestRow): SupportRequest {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyId: row.company_id,
    driverId: row.driver_id,
    requestType: row.request_type === 'feedback' ? 'feedback' : 'bug',
    category: row.category,
    title: row.title,
    description: row.description,
    stepsToReproduce: row.steps_to_reproduce,
    rating: row.rating,
    status: normalizeSupportStatus(row.status),
    supportResponse: row.support_response,
    respondedAt: row.responded_at,
    resolvedAt: row.resolved_at,
    reference: row.reference,
    appVersion: row.app_version,
    platform: (row.platform as SupportPlatform) || 'web',
    route: row.route,
    networkState: (row.network_state as SupportNetworkState) || 'online',
    deviceMetadata: (row.device_metadata ?? {}) as
      | SupportDeviceMetadata
      | SupportMinimalDeviceMetadata
      | Record<string, unknown>,
    attachmentPaths: row.attachment_paths ?? [],
  }
}

function createReference(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase()
  return `DRV-${rand}`
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function assertOnline(): void {
  // Synchronous browser check for submit guards; native callers also use UI offline state.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new SupportRequestsServiceError(
      'You’re offline. Reconnect to send this report.',
    )
  }
}

function isFullDeviceMetadata(
  metadata: SupportDeviceMetadata | SupportMinimalDeviceMetadata,
): metadata is SupportDeviceMetadata {
  return 'networkState' in metadata && 'route' in metadata
}

async function insertSupportRequest(input: {
  id: string
  companyId: string
  driverId: string
  requestType: SupportRequestType
  category: string
  title: string
  description: string
  stepsToReproduce: string | null
  rating: number | null
  reference: string
  metadata: SupportDeviceMetadata | SupportMinimalDeviceMetadata
  attachmentPaths: string[]
}): Promise<SupportRequest> {
  const full = isFullDeviceMetadata(input.metadata) ? input.metadata : null
  const payload = {
    id: input.id,
    company_id: input.companyId,
    driver_id: input.driverId,
    request_type: input.requestType,
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    steps_to_reproduce: input.stepsToReproduce,
    rating: input.rating,
    status: 'submitted',
    support_response: null,
    responded_at: null,
    resolved_at: null,
    reference: input.reference,
    app_version: input.metadata.appVersion || APP_VERSION,
    platform: input.metadata.platform,
    route: full?.route ?? null,
    network_state: full?.networkState ?? 'online',
    device_metadata: input.metadata,
    attachment_paths: input.attachmentPaths,
  }

  const { data, error } = await requireSupabase()
    .from('support_requests')
    .insert(payload)
    .select(supportRequestSelect)
    .single()

  logSupabaseQuery({
    service: 'supportRequestsService.insert',
    table: 'support_requests',
    data: data ? [data] : [],
    error,
  })

  if (error || !data) {
    throw friendlyError(error, 'Unable to send your support request. Please try again.')
  }

  return mapRow(data as SupportRequestRow)
}

export async function createBugSupportRequest(input: {
  driverId: string
  category: BugCategory
  title: string
  description: string
  stepsToReproduce: string
  files: File[]
  route: string
}): Promise<SupportRequest> {
  assertOnline()

  const titleError = validateSupportTitle(input.title)
  if (titleError) throw new SupportRequestsServiceError(titleError)
  const descriptionError = validateSupportDescription(input.description)
  if (descriptionError) throw new SupportRequestsServiceError(descriptionError)
  const stepsError = validateSupportSteps(input.stepsToReproduce)
  if (stepsError) throw new SupportRequestsServiceError(stepsError)
  const filesError = validateSupportScreenshotFiles(input.files)
  if (filesError) throw new SupportRequestsServiceError(filesError)

  const companyId = requireVerifiedCompanyId()
  const requestId = createRequestId()
  const metadata = await collectSupportDeviceMetadata(input.route)
  let uploaded: string[] = []

  try {
    uploaded = await uploadSupportAttachments({
      companyId,
      driverId: input.driverId,
      requestId,
      files: input.files,
    })

    return await insertSupportRequest({
      id: requestId,
      companyId,
      driverId: input.driverId,
      requestType: 'bug',
      category: input.category,
      title: input.title,
      description: input.description,
      stepsToReproduce: input.stepsToReproduce.trim() || null,
      rating: null,
      reference: createReference(),
      metadata,
      attachmentPaths: uploaded,
    })
  } catch (error) {
    await deleteSupportAttachments(uploaded)
    throw friendlyError(error, 'Unable to send your bug report. Please try again.')
  }
}

export async function createFeedbackSupportRequest(input: {
  driverId: string
  feedbackType: FeedbackType
  rating: number
  comment: string
  route: string
  title?: string
}): Promise<SupportRequest> {
  assertOnline()

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new SupportRequestsServiceError('Please choose a rating from 1 to 5 stars.')
  }
  const commentError = validateFeedbackComment(input.comment, input.rating)
  if (commentError) throw new SupportRequestsServiceError(commentError)

  const description =
    input.comment.trim() ||
    (input.rating >= 3 ? `Rating: ${input.rating} stars.` : '')
  if (!description) {
    throw new SupportRequestsServiceError('Please add a short comment.')
  }

  const companyId = requireVerifiedCompanyId()
  const metadata = collectMinimalSupportDeviceMetadata()
  const title =
    input.title?.trim() ||
    `${input.feedbackType} — ${input.rating} star${input.rating === 1 ? '' : 's'}`

  try {
    return await insertSupportRequest({
      id: createRequestId(),
      companyId,
      driverId: input.driverId,
      requestType: 'feedback',
      category: input.feedbackType,
      title: title.slice(0, 120),
      description: description.slice(0, 4000),
      stepsToReproduce: null,
      rating: input.rating,
      reference: createReference(),
      metadata,
      attachmentPaths: [],
    })
  } catch (error) {
    throw friendlyError(error, 'Unable to send your feedback. Please try again.')
  }
}

/** In-app rating stored as feedback with App Rating category. */
export async function submitAppRating(input: {
  driverId: string
  rating: number
  comment: string
  route: string
}): Promise<SupportRequest> {
  assertOnline()

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new SupportRequestsServiceError('Please choose a rating from 1 to 5 stars.')
  }
  const trimmed = input.comment.trim()
  if (trimmed.length > 500) {
    throw new SupportRequestsServiceError('Comment must be 500 characters or fewer.')
  }

  const companyId = requireVerifiedCompanyId()
  const metadata = collectMinimalSupportDeviceMetadata()
  const description =
    trimmed || `In-app rating: ${input.rating} star${input.rating === 1 ? '' : 's'}.`

  try {
    return await insertSupportRequest({
      id: createRequestId(),
      companyId,
      driverId: input.driverId,
      requestType: 'feedback',
      category: RATING_CATEGORY,
      title: `App rating — ${input.rating} star${input.rating === 1 ? '' : 's'}`,
      description: description.slice(0, 4000),
      stepsToReproduce: null,
      rating: input.rating,
      reference: createReference(),
      metadata,
      attachmentPaths: [],
    })
  } catch (error) {
    throw friendlyError(error, 'Unable to save your rating. Please try again.')
  }
}

export async function fetchOwnSupportRequests(
  filter: SupportRequestListFilter = 'all',
): Promise<SupportRequest[]> {
  const companyId = requireVerifiedCompanyId()
  let query = requireSupabase()
    .from('support_requests')
    .select(supportRequestSelect)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data, error } = await query

  logSupabaseQuery({
    service: 'supportRequestsService.fetchOwn',
    table: 'support_requests',
    data: data ?? [],
    error,
  })

  if (error) {
    throw friendlyError(error, 'Unable to load your support requests.')
  }

  return ((data ?? []) as SupportRequestRow[]).map(mapRow)
}

export async function fetchOwnSupportRequestById(
  requestId: string,
): Promise<SupportRequest> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('support_requests')
    .select(supportRequestSelect)
    .eq('company_id', companyId)
    .eq('id', requestId)
    .maybeSingle()

  logSupabaseQuery({
    service: 'supportRequestsService.fetchById',
    table: 'support_requests',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    throw friendlyError(error, 'Unable to load this support request.')
  }
  if (!data) {
    throw new SupportRequestsServiceError('Support request not found.')
  }

  return mapRow(data as SupportRequestRow)
}

export function getSupportStatusLabel(status: SupportRequestStatus): string {
  if (status === 'in_progress') return 'In Progress'
  if (status === 'resolved') return 'Resolved'
  if (status === 'closed') return 'Closed'
  return 'Submitted'
}
