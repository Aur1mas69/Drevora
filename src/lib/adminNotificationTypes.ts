export type NotificationSeverity = 'info' | 'warning' | 'critical'

export type NotificationType =
  | 'timesheet_submitted'
  | 'holiday_request_created'
  | 'vehicle_check_attention'
  | 'tyre_check_critical'
  | 'driver_report_created'
  | 'document_expiry'

export type AdminNotification = {
  id: string
  companyId: string
  notificationType: NotificationType
  severity: NotificationSeverity
  title: string
  message: string | null
  entityType: string | null
  entityId: string | null
  targetPath: string | null
  metadata: Record<string, unknown>
  dedupeKey: string
  createdAt: string
}

export type AdminNotificationWithReadState = AdminNotification & {
  isRead: boolean
  readAt: string | null
}

export const ADMIN_NOTIFICATIONS_DROPDOWN_LIMIT = 20
