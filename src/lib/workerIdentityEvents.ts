/**
 * Safe Worker Identity & Access History contracts (Admin UI).
 * Keep display allowlists in sync with drevora_list_worker_identity_events.
 */

export const WORKER_IDENTITY_EVENT_SAFE_FIELDS = [
  'id',
  'eventType',
  'createdAt',
  'reason',
  'actorLabel',
  'oldEmail',
  'newEmail',
] as const

export type WorkerIdentityEventSafeField =
  (typeof WORKER_IDENTITY_EVENT_SAFE_FIELDS)[number]

export type WorkerIdentityEvent = {
  id: string
  eventType: string
  createdAt: string
  reason: string | null
  actorLabel: string | null
  oldEmail: string | null
  newEmail: string | null
}

const EVENT_LABELS: Record<string, string> = {
  auth_user_backfilled: 'Auth user backfilled',
  auth_user_linked: 'Auth user linked',
  login_email_changed: 'Login email changed',
  access_email_sent: 'Account access email sent',
  name_corrected: 'Name corrected',
  identity_locked: 'Identity locked',
  replacement_blocked: 'Identity replacement blocked',
  identity_replacement_blocked: 'Identity replacement blocked',
  archived: 'Worker archived',
  restored: 'Worker restored',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function formatWorkerIdentityEventLabel(
  eventType: string | null | undefined,
): string {
  const key = (eventType ?? '').trim()
  if (!key) return 'Identity or access change'
  return EVENT_LABELS[key] ?? 'Identity or access change'
}

export function sanitizeWorkerIdentityEmail(
  value: unknown,
): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return null
  return email
}

export function sanitizeWorkerIdentityActorLabel(
  value: unknown,
): string | null {
  if (typeof value !== 'string') return null
  const label = value.trim()
  if (!label) return null
  // Never show bare UUIDs as the actor label.
  if (UUID_RE.test(label)) return null
  if (/sql|stack|exception|service.?role|jwt/i.test(label)) return null
  return label
}

export function sanitizeWorkerIdentityReason(
  value: unknown,
): string | null {
  if (typeof value !== 'string') return null
  const reason = value.trim()
  if (!reason) return null
  if (/sql|stack|exception|supabase|postgres|pgrst|jwt|service.?role/i.test(reason)) {
    return null
  }
  return reason
}

/** Map an RPC row into allowlisted UI fields only. */
export function mapWorkerIdentityEventRow(
  row: Record<string, unknown>,
): WorkerIdentityEvent | null {
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  const eventType =
    typeof row.event_type === 'string'
      ? row.event_type.trim()
      : typeof row.eventType === 'string'
        ? row.eventType.trim()
        : ''
  const createdAt =
    typeof row.created_at === 'string'
      ? row.created_at.trim()
      : typeof row.createdAt === 'string'
        ? row.createdAt.trim()
        : ''

  if (!id || !eventType || !createdAt) return null

  return {
    id,
    eventType,
    createdAt,
    reason: sanitizeWorkerIdentityReason(row.reason),
    actorLabel: sanitizeWorkerIdentityActorLabel(
      row.actor_label ?? row.actorLabel,
    ),
    oldEmail: sanitizeWorkerIdentityEmail(row.old_email ?? row.oldEmail),
    newEmail: sanitizeWorkerIdentityEmail(row.new_email ?? row.newEmail),
  }
}

export function sortWorkerIdentityEventsNewestFirst(
  events: WorkerIdentityEvent[],
): WorkerIdentityEvent[] {
  return [...events].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt)
    if (byTime !== 0) return byTime
    return b.id.localeCompare(a.id)
  })
}

export function formatWorkerIdentityHistoryError(
  codeOrMessage: string | null | undefined,
): string {
  const raw = (codeOrMessage ?? '').trim()
  const upper = raw.toUpperCase()
  if (upper.includes('UNAUTHENTICATED')) {
    return 'Your session has expired. Sign in again and try again.'
  }
  if (upper.includes('FORBIDDEN')) {
    return 'Only Office roles can view identity and access history.'
  }
  if (upper.includes('WORKER_NOT_FOUND')) {
    return 'Worker was not found in your company.'
  }
  if (
    raw &&
    !/sql|stack|exception|supabase|postgres|pgrst|jwt|service.?role/i.test(raw)
  ) {
    return 'Unable to load identity and access history. Please try again.'
  }
  return 'Unable to load identity and access history. Please try again.'
}

/** Fields that must never appear in UI copy or rendered JSON dumps. */
export function workerIdentityHistoryExposesForbiddenContent(
  haystack: string,
): boolean {
  return (
    /auth_user_id|actor_user_id|old_values|new_values|"raw_user_meta_data"/i.test(
      haystack,
    ) || /service_role|stack trace|postgres/i.test(haystack)
  )
}
