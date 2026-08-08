/**
 * Focused verification: Admin Dashboard Fleet Status effective availability
 * must exclude vehicles with blocking compliance expiries (MOT / insurance / tax).
 *
 * Run: npm run verify:fleet-status-compliance-blocking
 */
import {
  countDashboardFleetStatus,
  formatComplianceBlockedReason,
  getBlockingComplianceExpiries,
  resolveVehicleDashboardFleetStatus,
} from '../src/lib/fleetEffectiveStatus.ts'
import { buildFleetComplianceAlertsSummary } from '../src/lib/fleetComplianceAlerts.ts'
import type { Vehicle, VehicleStatus } from '../src/services/vehiclesService.ts'

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

const TODAY = '2026-08-08'

function makeVehicle(
  overrides: Partial<Vehicle> & { id: string; registration: string },
): Vehicle {
  const status = (overrides.status ?? overrides.baseStatus ?? 'Available') as VehicleStatus
  return {
    id: overrides.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    registration: overrides.registration,
    fleetNumber: null,
    trailerNumber: null,
    make: 'Test',
    model: 'Van',
    year: null,
    vin: null,
    currentOdometer: null,
    vehicleType: null,
    baseStatus: overrides.baseStatus ?? status,
    status,
    availabilityStatus: status,
    currentDriverId: null,
    insuranceExpiry: overrides.insuranceExpiry ?? '2027-01-01',
    motExpiry: overrides.motExpiry ?? '2027-01-01',
    roadTaxExpiry: overrides.roadTaxExpiry ?? '2027-01-01',
    tachographExpiry: overrides.tachographExpiry ?? '2027-01-01',
    offRoadReason: null,
    offRoadStartDate: null,
    offRoadExpectedReturnDate: null,
    offRoadStart: null,
    offRoadReturn: null,
    offRoadNotes: null,
    notes: null,
    availabilityRecords: overrides.availabilityRecords ?? [],
    archivedAt: overrides.archivedAt ?? null,
    archiveReason: overrides.archiveReason ?? null,
    retentionExpiresAt: overrides.retentionExpiresAt ?? null,
  }
}

run('1. Expired MOT removes vehicle from Available', () => {
  const vehicles = [
    makeVehicle({ id: 'v1', registration: 'AA01 AAA' }),
    makeVehicle({
      id: 'v2',
      registration: 'BB02 BBB',
      motExpiry: '2026-08-01',
    }),
  ]
  const counts = countDashboardFleetStatus(vehicles, TODAY)
  assertEqual(counts.available, 1, 'available')
  assertEqual(counts.offRoad, 1, 'offRoad')
  assertEqual(counts.maintenanceDue, 0, 'maintenanceDue')
})

run('2. Expired Insurance removes vehicle from Available', () => {
  const vehicles = [
    makeVehicle({
      id: 'v1',
      registration: 'AA01 AAA',
      insuranceExpiry: '2026-07-01',
    }),
  ]
  const counts = countDashboardFleetStatus(vehicles, TODAY)
  assertEqual(counts.available, 0, 'available')
  assertEqual(counts.offRoad, 1, 'offRoad')
})

run('3. Expired Tax removes vehicle from Available', () => {
  const vehicles = [
    makeVehicle({
      id: 'v1',
      registration: 'AA01 AAA',
      roadTaxExpiry: '2026-08-07',
    }),
  ]
  const counts = countDashboardFleetStatus(vehicles, TODAY)
  assertEqual(counts.available, 0, 'available')
  assertEqual(counts.offRoad, 1, 'offRoad')
})

run('4. Multiple expired items on one vehicle count as one Off road', () => {
  const vehicles = [
    makeVehicle({
      id: 'v1',
      registration: 'AA01 AAA',
      motExpiry: '2026-01-01',
      insuranceExpiry: '2026-02-01',
      roadTaxExpiry: '2026-03-01',
    }),
    ...Array.from({ length: 24 }, (_, index) =>
      makeVehicle({
        id: `ok-${index}`,
        registration: `OK${String(index).padStart(2, '0')} AAA`,
      }),
    ),
  ]
  const counts = countDashboardFleetStatus(vehicles, TODAY)
  assertEqual(counts.available, 24, 'available with 25 active, 1 blocked')
  assertEqual(counts.offRoad, 1, 'one off-road vehicle')
  assertEqual(counts.maintenanceDue, 0, 'maintenanceDue')

  const alerts = buildFleetComplianceAlertsSummary(vehicles, TODAY)
  assertEqual(alerts.overdueCount, 3, 'three overdue compliance items')

  const resolved = resolveVehicleDashboardFleetStatus(vehicles[0], TODAY)
  assertEqual(resolved.blockingExpiries.length, 3, 'three blocking expiries')
  assertEqual(
    formatComplianceBlockedReason(resolved.blockingExpiries),
    'Compliance blocked — MOT, Insurance, Tax expired',
    'reason text',
  )
  assertEqual(
    counts.offRoadHelper,
    'Compliance blocked — MOT, Insurance, Tax expired',
    'fleet helper',
  )
})

run('5. Renewed compliance restores Available when manual status allows', () => {
  const blocked = makeVehicle({
    id: 'v1',
    registration: 'AA01 AAA',
    motExpiry: '2026-01-01',
  })
  const renewed = makeVehicle({
    id: 'v1',
    registration: 'AA01 AAA',
    motExpiry: '2027-01-01',
  })

  assertEqual(
    resolveVehicleDashboardFleetStatus(blocked, TODAY).bucket,
    'off_road',
    'blocked bucket',
  )
  assertEqual(
    resolveVehicleDashboardFleetStatus(renewed, TODAY).bucket,
    'available',
    'renewed bucket',
  )
})

run('6. Manual Off road remains Off road', () => {
  const vehicle = makeVehicle({
    id: 'v1',
    registration: 'AA01 AAA',
    status: 'Off Road',
    baseStatus: 'Off Road',
    motExpiry: '2027-01-01',
    insuranceExpiry: '2027-01-01',
    roadTaxExpiry: '2027-01-01',
  })
  const resolved = resolveVehicleDashboardFleetStatus(vehicle, TODAY)
  assertEqual(resolved.bucket, 'off_road', 'manual off road bucket')
  assertEqual(resolved.complianceBlocked, false, 'not compliance blocked')
  assertEqual(resolved.blockingExpiries.length, 0, 'no blocking expiries')

  const counts = countDashboardFleetStatus([vehicle], TODAY)
  assertEqual(counts.offRoad, 1, 'offRoad count')
  assertEqual(counts.offRoadHelper, 'Needs attention', 'manual helper')
})

run('7. Archived vehicles excluded', () => {
  const vehicles = [
    makeVehicle({
      id: 'v1',
      registration: 'AA01 AAA',
      archivedAt: '2026-06-01T00:00:00.000Z',
      motExpiry: '2026-01-01',
    }),
    makeVehicle({ id: 'v2', registration: 'BB02 BBB' }),
  ]
  const counts = countDashboardFleetStatus(vehicles, TODAY)
  assertEqual(counts.available, 1, 'available')
  assertEqual(counts.offRoad, 0, 'offRoad')
  assertEqual(
    resolveVehicleDashboardFleetStatus(vehicles[0], TODAY).bucket,
    'excluded',
    'archived bucket',
  )
})

run('8. No double counting across headline buckets', () => {
  const vehicles = [
    makeVehicle({
      id: 'maint-blocked',
      registration: 'CC03 CCC',
      status: 'Maintenance',
      baseStatus: 'Maintenance',
      motExpiry: '2026-01-01',
    }),
    makeVehicle({
      id: 'maint-ok',
      registration: 'DD04 DDD',
      status: 'Maintenance',
      baseStatus: 'Maintenance',
    }),
    makeVehicle({
      id: 'oos',
      registration: 'EE05 EEE',
      status: 'Out of Service',
      baseStatus: 'Out of Service',
    }),
    makeVehicle({ id: 'ok', registration: 'FF06 FFF' }),
  ]

  const counts = countDashboardFleetStatus(vehicles, TODAY)
  assertEqual(counts.available, 1, 'available')
  assertEqual(counts.offRoad, 2, 'compliance-blocked maintenance + OOS')
  assertEqual(counts.maintenanceDue, 1, 'maintenance without compliance block')
  assertEqual(
    counts.available + counts.offRoad + counts.maintenanceDue,
    4,
    'headline sum equals active fleet (no Workshop/Reserved gap here)',
  )
})

run('9. Tachograph overdue does not block Available (MVP)', () => {
  const vehicle = makeVehicle({
    id: 'v1',
    registration: 'AA01 AAA',
    tachographExpiry: '2026-01-01',
  })
  assertEqual(
    resolveVehicleDashboardFleetStatus(vehicle, TODAY).bucket,
    'available',
    'tacho alone stays available',
  )
  assertEqual(getBlockingComplianceExpiries(vehicle, TODAY).length, 0, 'no blocking')

  const alerts = buildFleetComplianceAlertsSummary([vehicle], TODAY)
  assertEqual(alerts.overdueCount, 1, 'tacho still alerts overdue')
})

run('10. Fleet Status overdue semantics match Compliance Alerts (shared daysUntilDue < 0)', () => {
  const vehicle = makeVehicle({
    id: 'v1',
    registration: 'AA01 AAA',
    motExpiry: '2026-08-07',
    insuranceExpiry: TODAY,
    roadTaxExpiry: '2026-08-09',
  })

  const blocking = getBlockingComplianceExpiries(vehicle, TODAY)
  assertEqual(blocking.length, 1, 'only MOT expired (due today is not overdue)')
  assertEqual(blocking[0]?.type, 'mot', 'mot type')

  const alerts = buildFleetComplianceAlertsSummary([vehicle], TODAY)
  const overdueTypes = alerts.topAlerts
    .filter((alert) => alert.bucket === 'overdue')
    .map((alert) => alert.type)
    .sort()
  assertEqual(overdueTypes.join(','), 'mot', 'alerts overdue types')
  assertTrue(
    alerts.within7Count >= 1,
    'insurance due today is within_7, not overdue',
  )
})

console.log(`\nAll ${passed} checks passed.`)
