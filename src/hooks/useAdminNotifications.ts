import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdminNotificationWithReadState } from '@/lib/adminNotificationTypes'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { isOfficeMembershipRole } from '@/lib/membershipRoles'
import {
  AdminNotificationsServiceError,
  fetchAdminNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  maybeGenerateExpiryNotifications,
  subscribeToAdminNotifications,
} from '@/services/adminNotificationsService'

type UseAdminNotificationsResult = {
  notifications: AdminNotificationWithReadState[]
  unreadCount: number
  hasUnreadCritical: boolean
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  markOneRead: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useAdminNotifications(): UseAdminNotificationsResult {
  const { companyId, companyReady, membershipRole } = useCompanySettings()
  const [notifications, setNotifications] = useState<AdminNotificationWithReadState[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const canLoad =
    companyReady && Boolean(companyId) && isOfficeMembershipRole(membershipRole)

  const refresh = useCallback(async () => {
    if (!canLoad) {
      setNotifications([])
      setError(null)
      return
    }

    setIsLoading(true)
    try {
      await maybeGenerateExpiryNotifications()
      const rows = await fetchAdminNotifications()
      if (!mountedRef.current) return
      setNotifications(rows)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      const message =
        err instanceof AdminNotificationsServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load notifications.'
      setError(message)
      if (import.meta.env.DEV) {
        console.error('[admin-notifications] load failed:', err)
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [canLoad])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    return () => {
      mountedRef.current = false
    }
  }, [refresh])

  useEffect(() => {
    if (!canLoad || !companyId) return

    const unsubscribe = subscribeToAdminNotifications(companyId, () => {
      void refresh()
    })

    function handleFocus() {
      void refresh()
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      unsubscribe()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [canLoad, companyId, refresh])

  const markOneRead = useCallback(
    async (notificationId: string) => {
      const previous = notifications
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item,
        ),
      )

      try {
        await markNotificationRead(notificationId)
      } catch (err) {
        setNotifications(previous)
        throw err instanceof AdminNotificationsServiceError
          ? err
          : new AdminNotificationsServiceError(
              err instanceof Error ? err.message : 'Unable to mark notification as read.',
            )
      }
    },
    [notifications],
  )

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((item) => !item.isRead).map((item) => item.id)
    if (unreadIds.length === 0) return

    const previous = notifications
    const readAt = new Date().toISOString()
    setNotifications((current) =>
      current.map((item) =>
        item.isRead ? item : { ...item, isRead: true, readAt },
      ),
    )

    try {
      await markAllNotificationsRead(unreadIds)
    } catch (err) {
      setNotifications(previous)
      throw err instanceof AdminNotificationsServiceError
        ? err
        : new AdminNotificationsServiceError(
            err instanceof Error ? err.message : 'Unable to mark all notifications as read.',
          )
    }
  }, [notifications])

  const unreadCount = notifications.reduce(
    (count, item) => (item.isRead ? count : count + 1),
    0,
  )
  const hasUnreadCritical = notifications.some(
    (item) => !item.isRead && item.severity === 'critical',
  )

  return {
    notifications,
    unreadCount,
    hasUnreadCritical,
    isLoading,
    error,
    refresh,
    markOneRead,
    markAllRead,
  }
}
