import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CircleAlert,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminPopoverShell } from '@/lib/adminUiStyles'
import { useAdminNotifications } from '@/hooks/useAdminNotifications'
import type {
  AdminNotificationWithReadState,
  NotificationSeverity,
} from '@/lib/adminNotificationTypes'
import { cn } from '@/lib/utils'

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffMs = date.getTime() - Date.now()
  const absSec = Math.round(Math.abs(diffMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  const absMin = Math.round(absSec / 60)
  if (absMin < 60) return rtf.format(Math.round(diffMs / 60000), 'minute')
  const absHour = Math.round(absMin / 60)
  if (absHour < 48) return rtf.format(Math.round(diffMs / 3600000), 'hour')
  return rtf.format(Math.round(diffMs / 86400000), 'day')
}

function severityIcon(severity: NotificationSeverity) {
  if (severity === 'critical') {
    return <CircleAlert className="size-4 text-rose-600 dark:text-rose-300" aria-hidden />
  }
  if (severity === 'warning') {
    return <AlertTriangle className="size-4 text-amber-600 dark:text-amber-300" aria-hidden />
  }
  return <Info className="size-4 text-blue-600 dark:text-blue-300" aria-hidden />
}

function resolveTargetPath(item: AdminNotificationWithReadState): string {
  if (item.targetPath && item.targetPath.startsWith('/')) {
    return item.targetPath
  }

  switch (item.notificationType) {
    case 'timesheet_submitted':
      return '/admin/timesheets'
    case 'holiday_request_created':
      return '/admin/holidays'
    case 'vehicle_check_attention':
      return '/admin/vehicle-checks'
    case 'tyre_check_critical':
      return '/admin/vehicle-checks?tab=tyre-check&section=history'
    case 'driver_report_created':
      return '/admin/driver-reports'
    case 'document_expiry':
      return '/documents'
    default:
      return '/admin'
  }
}

export function AdminNotificationBell() {
  const navigate = useNavigate()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const {
    notifications,
    unreadCount,
    hasUnreadCritical,
    isLoading,
    error,
    refresh,
    markOneRead,
    markAllRead,
  } = useAdminNotifications()

  const badgeLabel = useMemo(() => {
    if (hasUnreadCritical) return 'Critical unread notifications'
    if (unreadCount <= 0) return 'Notifications'
    return `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
  }, [hasUnreadCritical, unreadCount])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleOpenToggle() {
    setActionError(null)
    setOpen((current) => !current)
  }

  async function handleMarkAll() {
    setActionError(null)
    try {
      await markAllRead()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark all as read.')
    }
  }

  async function handleRowClick(item: AdminNotificationWithReadState) {
    setActionError(null)
    try {
      if (!item.isRead) {
        await markOneRead(item.id)
      }
      setOpen(false)
      navigate(resolveTargetPath(item))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to open notification.')
    }
  }

  const unreadBadgeText = unreadCount > 99 ? '99+' : String(unreadCount)

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={badgeLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => void handleOpenToggle()}
        className={cn(
          'relative size-10 shrink-0 rounded-[1rem] bg-white/90 text-slate-500 shadow-sm ring-1 ring-[#D7E8FF] transition-all duration-200 ease-out hover:bg-white hover:text-[#3B82F6] hover:shadow-md dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-blue-300',
          unreadCount > 0 && 'text-rose-600 dark:text-rose-300',
          hasUnreadCritical &&
            'ring-rose-300/80 dark:ring-rose-500/50 motion-safe:animate-pulse',
        )}
      >
        <Bell className="size-[18px]" />
        {hasUnreadCritical ? (
          <span
            className="absolute -top-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
            aria-hidden
          >
            !
          </span>
        ) : unreadCount > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white dark:ring-slate-900"
            aria-hidden
          >
            {unreadBadgeText}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={cn(
            adminPopoverShell,
            'absolute top-full right-0 z-[80] mt-2 flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(28rem,70vh)] flex-col overflow-hidden p-0 dark:bg-slate-900/98 sm:w-[22rem]',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#E8F3FE] px-3.5 py-3 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
                Notifications
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#5499BF] dark:text-slate-400">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : isLoading
                    ? 'Loading…'
                    : 'You’re all caught up'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="inline-flex shrink-0 items-center gap-1 rounded-[10px] px-2 py-1.5 text-xs font-semibold text-[#0B68BE] transition-colors hover:bg-[#EEF6FF] dark:text-blue-300 dark:hover:bg-slate-800/70"
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Mark all as read
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {error ? (
              <div className="space-y-2 px-3.5 py-4 text-sm">
                <p className="font-medium text-rose-600 dark:text-rose-300" role="alert">
                  Unable to load notifications.
                </p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="text-xs font-semibold text-[#0B68BE] underline-offset-2 hover:underline dark:text-blue-300"
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3.5 py-8 text-center">
                <p className="text-sm font-semibold text-[#113C69] dark:text-slate-100">
                  You’re all caught up
                </p>
                <p className="mt-1 text-xs text-[#5499BF] dark:text-slate-400">
                  New office alerts will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#EEF6FF] dark:divide-white/10">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void handleRowClick(item)}
                      className={cn(
                        'flex w-full gap-3 px-3.5 py-3 text-left transition-colors',
                        item.isRead
                          ? 'bg-transparent hover:bg-[#F8FBFF] dark:hover:bg-slate-800/50'
                          : 'bg-[#F5FAFF] hover:bg-[#EEF6FF] dark:bg-slate-800/55 dark:hover:bg-slate-800/80',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ring-1',
                          item.severity === 'critical'
                            ? 'bg-rose-50 ring-rose-100 dark:bg-rose-950/50 dark:ring-rose-900/60'
                            : item.severity === 'warning'
                              ? 'bg-amber-50 ring-amber-100 dark:bg-amber-950/50 dark:ring-amber-900/60'
                              : 'bg-[#EEF6FF] ring-[#C5DFFB] dark:bg-blue-950/40 dark:ring-blue-900/60',
                        )}
                      >
                        {severityIcon(item.severity)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              'text-sm font-semibold leading-snug',
                              item.isRead
                                ? 'text-slate-600 dark:text-slate-300'
                                : 'text-[#113C69] dark:text-slate-100',
                            )}
                          >
                            {item.title}
                          </span>
                          {!item.isRead ? (
                            <span
                              className="mt-1 size-2 shrink-0 rounded-full bg-rose-500"
                              aria-label="Unread"
                            />
                          ) : null}
                        </span>
                        {item.message ? (
                          <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-[#5499BF] dark:text-slate-400">
                            {item.message}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {actionError ? (
            <p
              className="border-t border-[#E8F3FE] px-3.5 py-2 text-xs font-medium text-rose-600 dark:border-white/10 dark:text-rose-300"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
