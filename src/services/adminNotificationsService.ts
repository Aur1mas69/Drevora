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

type SharedAdminNotificationsSubscription = {
  companyId: string
  userId: string
  channel: RealtimeChannel
  listeners: Set<() => void>
  failed: boolean
  removed: boolean
}

/** One live realtime channel per office user/company — shared across bell mounts. */
let sharedAdminNotificationsSubscription: SharedAdminNotificationsSubscription | null = null
let adminNotificationsChannelSeq = 0
let lastRealtimeWarningKey: string | null = null

function warnRealtimeOnce(key: string, ...args: unknown[]) {
  if (!import.meta.env.DEV) return
  if (lastRealtimeWarningKey === key) return
  lastRealtimeWarningKey = key
  console.warn('[admin-notifications]', ...args)
}

function notifyAdminNotificationListeners(
  shared: SharedAdminNotificationsSubscription,
) {
  for (const listener of shared.listeners) {
    try {
      listener()
    } catch {
      // Listener errors must not tear down the shared channel.
    }
  }
}

function teardownSharedAdminNotificationsSubscription(
  shared: SharedAdminNotificationsSubscription,
) {
  if (shared.removed) return
  shared.removed = true
  shared.listeners.clear()
  if (sharedAdminNotificationsSubscription === shared) {
    sharedAdminNotificationsSubscription = null
  }
  void requireSupabase().removeChannel(shared.channel)
}

/**
 * Subscribe to admin notification inbox changes for one company/user.
 * Multiple React mounts (e.g. mobile + desktop bells) share one channel.
 * All postgres_changes handlers are registered before subscribe().
 */
export function subscribeToAdminNotifications(
  companyId: string,
  userId: string,
  onChange: () => void,
): () => void {
  if (!isSupabaseConfigured || !companyId || !userId) {
    return () => undefined
  }

  const active = sharedAdminNotificationsSubscription
  if (
    active &&
    !active.removed &&
    !active.failed &&
    active.companyId === companyId &&
    active.userId === userId
  ) {
    active.listeners.add(onChange)
    let cleaned = false
    return () => {
      if (cleaned) return
      cleaned = true
      if (!sharedAdminNotificationsSubscription || sharedAdminNotificationsSubscription.removed) {
        return
      }
      sharedAdminNotificationsSubscription.listeners.delete(onChange)
      if (sharedAdminNotificationsSubscription.listeners.size === 0) {
        teardownSharedAdminNotificationsSubscription(sharedAdminNotificationsSubscription)
      }
    }
  }

  if (active && !active.removed) {
    teardownSharedAdminNotificationsSubscription(active)
  }

  const client = requireSupabase()
  // Unique topic per create avoids reusing a still-joining channel after async remove.
  const channelName = `admin-notifications:${companyId}:${userId}:${++adminNotificationsChannelSeq}`

  try {
    const channel = client.channel(channelName)

    const shared: SharedAdminNotificationsSubscription = {
      companyId,
      userId,
      channel,
      listeners: new Set([onChange]),
      failed: false,
      removed: false,
    }

    // Register every postgres_changes handler before subscribe().
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          if (!shared.removed && !shared.failed) {
            notifyAdminNotificationListeners(shared)
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_reads',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (!shared.removed && !shared.failed) {
            notifyAdminNotificationListeners(shared)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          shared.failed = true
          warnRealtimeOnce(
            `${channelName}:${status}`,
            'Realtime subscribe failed:',
            status,
            '— Admin continues without live push.',
          )
        }
      })

    sharedAdminNotificationsSubscription = shared

    let cleaned = false
    return () => {
      if (cleaned) return
      cleaned = true
      if (
        !sharedAdminNotificationsSubscription ||
        sharedAdminNotificationsSubscription !== shared ||
        shared.removed
      ) {
        return
      }
      shared.listeners.delete(onChange)
      if (shared.listeners.size === 0) {
        teardownSharedAdminNotificationsSubscription(shared)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnRealtimeOnce(message, 'Realtime subscribe failed:', error)
    return () => undefined
  }
}

export const adminNotificationsService = {
  fetchAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  maybeGenerateExpiryNotifications,
  subscribeToAdminNotifications,
}
