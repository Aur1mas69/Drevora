/** Worker Help & Support — shared types and validation constants. */

export type SupportRequestType = 'bug' | 'feedback'

export type SupportRequestStatus =
  | 'submitted'
  | 'in_progress'
  | 'resolved'
  | 'closed'

export type SupportPlatform = 'android' | 'web' | 'pwa'

export type SupportNetworkState = 'online' | 'offline'

export const BUG_CATEGORIES = [
  'Login / Account',
  'Timesheets',
  'Holiday Requests',
  'Vehicle Checks',
  'Tyre Checks',
  'Vehicles',
  'Documents',
  'Contacts',
  'Offline / Sync',
  'Performance',
  'Design / Display',
  'Notifications',
  'Other',
] as const

export type BugCategory = (typeof BUG_CATEGORIES)[number]

export const FEEDBACK_TYPES = [
  'Suggestion',
  'Ease of Use',
  'Design',
  'Performance',
  'Feature Request',
  'Other',
] as const

export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

/** Category stored for in-app ratings. */
export const RATING_CATEGORY = 'App Rating' as const

export const SUPPORT_STATUS_LABELS: Record<SupportRequestStatus, string> = {
  submitted: 'Submitted',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const SUPPORT_TITLE_MIN = 5
export const SUPPORT_TITLE_MAX = 120
export const SUPPORT_DESCRIPTION_MIN = 10
export const SUPPORT_DESCRIPTION_MAX = 4000
export const SUPPORT_STEPS_MAX = 4000
export const SUPPORT_COMMENT_MAX = 2000
export const SUPPORT_RATE_COMMENT_MAX = 500
export const SUPPORT_MAX_ATTACHMENTS = 3
export const SUPPORT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const SUPPORT_ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** Attached silently on Rate / Feedback — no extra diagnostics. */
export type SupportMinimalDeviceMetadata = {
  appVersion: string
  platform: SupportPlatform
  submittedAt: string
}

/** Full diagnostics attached on Bug reports only. */
export type SupportDeviceMetadata = SupportMinimalDeviceMetadata & {
  route: string
  networkState: SupportNetworkState
  userAgent: string
  screenWidth: number
  screenHeight: number
  locale: string
  timezone: string
}

export type SupportRequest = {
  id: string
  createdAt: string
  updatedAt: string
  companyId: string
  driverId: string
  requestType: SupportRequestType
  category: string
  title: string
  description: string
  stepsToReproduce: string | null
  rating: number | null
  status: SupportRequestStatus
  supportResponse: string | null
  respondedAt: string | null
  resolvedAt: string | null
  reference: string
  appVersion: string
  platform: SupportPlatform
  route: string | null
  networkState: SupportNetworkState
  deviceMetadata:
    | SupportDeviceMetadata
    | SupportMinimalDeviceMetadata
    | Record<string, unknown>
  attachmentPaths: string[]
}

export type SupportRequestListFilter = 'all' | 'submitted' | 'in_progress' | 'resolved'

export function normalizeSupportStatus(
  value: string | null | undefined,
): SupportRequestStatus {
  if (
    value === 'in_progress' ||
    value === 'resolved' ||
    value === 'closed' ||
    value === 'submitted'
  ) {
    return value
  }
  return 'submitted'
}

export function validateSupportTitle(title: string): string | null {
  const trimmed = title.trim()
  if (trimmed.length < SUPPORT_TITLE_MIN) {
    return `Title must be at least ${SUPPORT_TITLE_MIN} characters.`
  }
  if (trimmed.length > SUPPORT_TITLE_MAX) {
    return `Title must be ${SUPPORT_TITLE_MAX} characters or fewer.`
  }
  return null
}

export function validateSupportDescription(description: string): string | null {
  const trimmed = description.trim()
  if (trimmed.length < SUPPORT_DESCRIPTION_MIN) {
    return `Description must be at least ${SUPPORT_DESCRIPTION_MIN} characters.`
  }
  if (trimmed.length > SUPPORT_DESCRIPTION_MAX) {
    return `Description must be ${SUPPORT_DESCRIPTION_MAX} characters or fewer.`
  }
  return null
}

export function validateSupportSteps(steps: string): string | null {
  if (!steps.trim()) return null
  if (steps.length > SUPPORT_STEPS_MAX) {
    return `Steps to reproduce must be ${SUPPORT_STEPS_MAX} characters or fewer.`
  }
  return null
}

export function validateFeedbackComment(
  comment: string,
  rating: number,
): string | null {
  const trimmed = comment.trim()
  if ((rating === 1 || rating === 2) && !trimmed) {
    return 'Please add a comment for ratings of 1 or 2 stars.'
  }
  if (trimmed.length > SUPPORT_COMMENT_MAX) {
    return `Comment must be ${SUPPORT_COMMENT_MAX} characters or fewer.`
  }
  return null
}
