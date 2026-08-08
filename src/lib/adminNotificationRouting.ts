/**
 * Admin notification click → route resolution.
 * Tyre notifications must open the Tyre Check tab even when stored target_path
 * is the bare /admin/vehicle-checks path written by older notify triggers.
 */

import type {
  AdminNotification,
  NotificationType,
} from '@/lib/adminNotificationTypes'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isAdminNotificationEntityId(
  value: string | null | undefined,
): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

/** Query key used to deep-open a Tyre Check View drawer. */
export const TYRE_CHECK_NOTIFICATION_QUERY_KEY = 'tyre_check_id'

export function buildTyreCheckNotificationPath(input?: {
  tyreCheckId?: string | null
}): string {
  const params = new URLSearchParams()
  params.set('tab', 'tyre-check')
  params.set('section', 'history')
  const id = input?.tyreCheckId?.trim()
  if (id && isAdminNotificationEntityId(id)) {
    params.set(TYRE_CHECK_NOTIFICATION_QUERY_KEY, id)
  }
  return `/admin/vehicle-checks?${params.toString()}`
}

export function buildVehicleCheckNotificationPath(): string {
  return '/admin/vehicle-checks'
}

export function isTyreRelatedNotificationType(
  type: NotificationType | string | null | undefined,
): boolean {
  return type === 'tyre_check_critical'
}

export function isVehicleCheckNotificationType(
  type: NotificationType | string | null | undefined,
): boolean {
  return type === 'vehicle_check_attention'
}

/**
 * Resolve navigation path for an Admin notification row click.
 * Type-aware routes for tyre / vehicle-check win over stale stored target_path.
 */
export function resolveAdminNotificationTargetPath(
  item: Pick<
    AdminNotification,
    'notificationType' | 'targetPath' | 'entityId' | 'entityType' | 'metadata'
  >,
): string {
  if (isTyreRelatedNotificationType(item.notificationType)) {
    const fromEntity =
      item.entityType === 'tyre_check' && isAdminNotificationEntityId(item.entityId)
        ? item.entityId
        : null
    const fromMetaRaw = item.metadata?.tyre_check_id
    const fromMeta =
      typeof fromMetaRaw === 'string' && isAdminNotificationEntityId(fromMetaRaw)
        ? fromMetaRaw.trim()
        : null
    return buildTyreCheckNotificationPath({
      tyreCheckId: fromEntity ?? fromMeta,
    })
  }

  if (isVehicleCheckNotificationType(item.notificationType)) {
    return buildVehicleCheckNotificationPath()
  }

  if (item.targetPath && item.targetPath.startsWith('/')) {
    return item.targetPath
  }

  switch (item.notificationType) {
    case 'timesheet_submitted':
      return '/admin/timesheets'
    case 'holiday_request_created':
      return '/admin/holidays'
    case 'driver_report_created':
      return '/admin/driver-reports'
    case 'document_expiry':
      return '/documents'
    default:
      return '/admin'
  }
}
