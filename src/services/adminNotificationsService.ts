import {
  ADMIN_NOTIFICATIONS_DROPDOWN_LIMIT,
  type AdminNotification,
  type AdminNotificationWithReadState,
  type NotificationSeverity,
  type NotificationType,
} from '@/lib/adminNotificationTypes'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import {
  resolveCurrentCompanyId,
  resolveCurrentCompanyMembership,
} from '@/services/companyMembershipService'
import { isOfficeMembershipRole } from '@/lib/membershipRoles'
import type { RealtimeChannel } from '@supabase/supabase-js'

export class AdminNotificationsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminNotificationsServiceError'
  }
}

type NotificationDbRow = {
  id: string
  company_id: string
  notification_type: string
  severity: string
  title: string
  message: string | null
  entity_type: string | null
  entity_id: string | null
  target_path: string | null
  metadata: Record<string, unknown> | null
  dedupe_key: string
  created_at: string
}

type NotificationReadDbRow = {
  notification_id: string
  user_id: string
  read_at: string
}

function mapNotification(row: NotificationDbRow): AdminNotification {
  return {
    id: row.id,
    companyId: row.company_id,
    notificationType: row.notification_type as NotificationType,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    targetPath: row.target_path,
    metadata: row.metadata ?? {},
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at,
  }
}

async function requireOfficeCompanyContext(): Promise<{
  userId: string
  companyId: string
}> {
  if (!isSupabaseConfigured) {
    throw new AdminNotificationsServiceError('Supabase is not configured.')
  }

  const membership = await resolveCurrentCompanyMembership()
  if (membership.status !== 'ready') {
    throw new AdminNotificationsServiceError(
      membership.status === 'unauthenticated'
        ? 'Sign in to load notifications.'
        : membership.message,
    )
  }

  if (!isOfficeMembershipRole(membership.membershipRole)) {
    throw new AdminNotificationsServiceError('Office access required for notifications.')
  }

  return { userId: membership.userId, companyId: membership.companyId }
}

export async function fetchAdminNotifications(
  options: { limit?: number } = {},
): Promise<AdminNotificationWithReadState[]> {
  const { userId, companyId } = await requireOfficeCompanyContext()
  const limit = options.limit ?? ADMIN_NOTIFICATIONS_DROPDOWN_LIMIT
  const client = requireSupabase()

  const { data, error } = await client
    .from('notifications')
    .select(
      'id, company_id, notification_type, severity, title, message, entity_type, entity_id, target_path, metadata, dedupe_key, created_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new AdminNotificationsServiceError(error.message)
  }

  const rows = (data as NotificationDbRow[] | null) ?? []
  if (rows.length === 0) return []

  const ids = rows.map((row) => row.id)
  const { data: reads, error: readsError } = await client
    .from('notification_reads')
    .select('notification_id, user_id, read_at')
    .eq('user_id', userId)
    .in('notification_id', ids)

  if (readsError) {
    throw new AdminNotificationsServiceError(readsError.message)
  }

  const readMap = new Map(
    ((reads as NotificationReadDbRow[] | null) ?? []).map((row) => [
      row.notification_id,
      row.read_at,
    ]),
  )

  return rows.map((row) => {
    const readAt = readMap.get(row.id) ?? null
    return {
      ...mapNotification(row),
      isRead: Boolean(readAt),
      readAt,
    }
  })
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { userId } = await requireOfficeCompanyContext()
  const { error } = await requireSupabase().from('notification_reads').upsert(
    {
      notification_id: notificationId,
      user_id: userId,
      read_at: new Date().toISOString(),
    },
    { onConflict: 'notification_id,user_id' },
  )

  if (error) {
    throw new AdminNotificationsServiceError(error.message)
  }
}

export async function markAllNotificationsRead(
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return

  const { userId } = await requireOfficeCompanyContext()
  const readAt = new Date().toISOString()
  const rows = notificationIds.map((notificationId) => ({
    notification_id: notificationId,
    user_id: userId,
    read_at: readAt,
  }))

  const { error } = await requireSupabase()
    .from('notification_reads')
    .upsert(rows, { onConflict: 'notification_id,user_id' })

  if (error) {
    throw new AdminNotificationsServiceError(error.message)
  }
}

const EXPIRY_SCAN_SESSION_KEY = 'drevora.admin.expiryNotificationScanAt'
const EXPIRY_SCAN_INTERVAL_MS = 30 * 60 * 1000

export async function maybeGenerateExpiryNotifications(): Promise<void> {
  try {
    const companyId = await resolveCurrentCompanyId()
    if (!companyId) return

    const storageKey = `${EXPIRY_SCAN_SESSION_KEY}:${companyId}`
    const last = sessionStorage.getItem(storageKey)
    if (last) {
      const elapsed = Date.now() - Number(last)
      if (Number.isFinite(elapsed) && elapsed < EXPIRY_SCAN_INTERVAL_MS) {
        return
      }
    }

    const { error } = await requireSupabase().rpc('drevora_generate_expiry_notifications')
    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[admin-notifications] expiry scan skipped:', error.message)
      }
      return
    }

    sessionStorage.setItem(storageKey, String(Date.now()))
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[admin-notifications] expiry scan failed:', error)
    }
  }
}

export function subscribeToAdminNotifications(
  companyId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured || !companyId) {
    return () => undefined
  }

  let channel: RealtimeChannel | null = null

  try {
    channel = requireSupabase()
      .channel(`admin-notifications:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          onChange()
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && import.meta.env.DEV) {
          console.warn('[admin-notifications] Realtime channel error — Admin continues without live push.')
        }
      })
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[admin-notifications] Realtime subscribe failed:', error)
    }
    return () => undefined
  }

  return () => {
    if (channel) {
      void requireSupabase().removeChannel(channel)
    }
  }
}

export const adminNotificationsService = {
  fetchAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  maybeGenerateExpiryNotifications,
  subscribeToAdminNotifications,
}
