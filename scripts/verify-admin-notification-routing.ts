/**
 * Focused verification for Admin notification → Tyre Check routing.
 * Run: npm run verify:admin-notification-routing
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TYRE_CHECK_NOTIFICATION_QUERY_KEY,
  buildTyreCheckNotificationPath,
  buildVehicleCheckNotificationPath,
  isTyreRelatedNotificationType,
  isVehicleCheckNotificationType,
  resolveAdminNotificationTargetPath,
} from '../src/lib/adminNotificationRouting.ts'

let passed = 0

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

const SAMPLE_TYRE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SAMPLE_VEHICLE_CHECK_ID = '11111111-2222-4333-8444-555555555555'

const bellSource = readFileSync(
  resolve('src/components/admin/AdminNotificationBell.tsx'),
  'utf8',
)
const panelSource = readFileSync(
  resolve('src/components/vehicle-checks/TyreCheckPanel.tsx'),
  'utf8',
)
const pageSource = readFileSync(resolve('src/pages/VehicleChecksPage.tsx'), 'utf8')

run('1. Critical tyre issue → Tyre Check tab (ignores stale target_path)', () => {
  assertTrue(isTyreRelatedNotificationType('tyre_check_critical'), 'tyre type')
  const path = resolveAdminNotificationTargetPath({
    notificationType: 'tyre_check_critical',
    targetPath: '/admin/vehicle-checks',
    entityType: 'tyre_check',
    entityId: SAMPLE_TYRE_ID,
    metadata: {},
  })
  assertTrue(path.includes('tab=tyre-check'), 'tab=tyre-check')
  assertTrue(path.includes('section=history'), 'section=history')
  assertTrue(
    path.includes(`${TYRE_CHECK_NOTIFICATION_QUERY_KEY}=${SAMPLE_TYRE_ID}`),
    'includes tyre_check_id',
  )
  assertTrue(!path.endsWith('/admin/vehicle-checks'), 'not bare vehicle-checks')
})

run('2. specific tyre_check_id → correct View deep-link query', () => {
  const path = buildTyreCheckNotificationPath({ tyreCheckId: SAMPLE_TYRE_ID })
  assertEqual(
    path,
    `/admin/vehicle-checks?tab=tyre-check&section=history&tyre_check_id=${SAMPLE_TYRE_ID}`,
    'exact deep-link path',
  )
  assertTrue(
    panelSource.includes('TYRE_CHECK_NOTIFICATION_QUERY_KEY') &&
      panelSource.includes('openTyreCheckDetailById'),
    'TyreCheckPanel opens View from query',
  )
})

run('3. generic tyre notification → Tyre Check tab without id', () => {
  const path = resolveAdminNotificationTargetPath({
    notificationType: 'tyre_check_critical',
    targetPath: '/admin/vehicle-checks',
    entityType: 'tyre_check',
    entityId: null,
    metadata: {},
  })
  assertEqual(
    path,
    '/admin/vehicle-checks?tab=tyre-check&section=history',
    'generic tyre path',
  )
  assertTrue(!path.includes('tyre_check_id='), 'no empty id query')
})

run('4. normal Vehicle Check notification → Vehicle Checks tab', () => {
  assertTrue(
    isVehicleCheckNotificationType('vehicle_check_attention'),
    'vehicle check type',
  )
  const path = resolveAdminNotificationTargetPath({
    notificationType: 'vehicle_check_attention',
    targetPath: '/admin/vehicle-checks',
    entityType: 'vehicle_check',
    entityId: SAMPLE_VEHICLE_CHECK_ID,
    metadata: {},
  })
  assertEqual(path, buildVehicleCheckNotificationPath(), 'vehicle checks path')
  assertTrue(!path.includes('tab=tyre-check'), 'not tyre tab')
})

run('5. no regression to other notification navigation', () => {
  assertEqual(
    resolveAdminNotificationTargetPath({
      notificationType: 'timesheet_submitted',
      targetPath: '/admin/timesheets',
      entityType: 'timesheet',
      entityId: SAMPLE_TYRE_ID,
      metadata: {},
    }),
    '/admin/timesheets',
    'timesheet',
  )
  assertEqual(
    resolveAdminNotificationTargetPath({
      notificationType: 'holiday_request_created',
      targetPath: null,
      entityType: null,
      entityId: null,
      metadata: {},
    }),
    '/admin/holidays',
    'holiday fallback',
  )
  assertEqual(
    resolveAdminNotificationTargetPath({
      notificationType: 'driver_report_created',
      targetPath: '/admin/driver-reports',
      entityType: null,
      entityId: null,
      metadata: {},
    }),
    '/admin/driver-reports',
    'driver report',
  )
  assertEqual(
    resolveAdminNotificationTargetPath({
      notificationType: 'document_expiry',
      targetPath: null,
      entityType: null,
      entityId: null,
      metadata: {},
    }),
    '/documents',
    'document expiry',
  )
  assertTrue(
    bellSource.includes('resolveAdminNotificationTargetPath') &&
      !bellSource.includes('function resolveTargetPath'),
    'bell uses shared resolver',
  )
  assertTrue(
    pageSource.includes("next.delete('tyre_check_id')"),
    'leaving tyre tab clears deep-link param',
  )
})

console.log(`\nverify-admin-notification-routing: ${passed} checks passed`)
