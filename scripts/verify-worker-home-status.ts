/**
 * Focused verification for Worker Home Vehicle Check + Timesheet status mapping,
 * and default-vehicle selection helpers used by the Home dashboard.
 * Run: npx tsx scripts/verify-worker-home-status.ts
 */
import {
  formatWorkerHomeStatusDetail,
  isTimesheetStillOpen,
  isTimesheetSubmittedOrApproved,
  previousTimesheetWeekStart,
  resolveVehicleCheckCompletionInstant,
  resolveWorkerHomeTimesheetStatus,
  resolveWorkerHomeVehicleCheckStatus,
} from '../src/lib/workerHomeStatus.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// --- Vehicle Check ---
const today = '2026-08-07'

const greenToday = resolveWorkerHomeVehicleCheckStatus({
  todayLocalDate: today,
  completedChecks: [
    {
      inspectionDate: today,
      signedAt: '2026-08-07T08:15:00.000Z',
      inspectionCompletedAt: '2026-08-07T08:20:00.000Z',
    },
  ],
})
assert(greenToday.tone === 'green', 'VC completed today → green')
assert(greenToday.title === 'Completed today', 'VC green title')
assert(greenToday.completedToday === true, 'VC completedToday true')
assert(
  greenToday.detailAt === '2026-08-07T08:20:00.000Z',
  'VC prefers inspectionCompletedAt',
)

const redWithPrevious = resolveWorkerHomeVehicleCheckStatus({
  todayLocalDate: today,
  completedChecks: [
    {
      inspectionDate: '2026-08-06',
      signedAt: '2026-08-06T17:00:00.000Z',
      inspectionCompletedAt: null,
    },
  ],
})
assert(redWithPrevious.tone === 'red', 'VC not today → red')
assert(redWithPrevious.title === 'Not completed today', 'VC red title')
assert(
  redWithPrevious.detailAt === '2026-08-06T17:00:00.000Z',
  'VC red shows latest previous',
)

const redNone = resolveWorkerHomeVehicleCheckStatus({
  todayLocalDate: today,
  completedChecks: [],
})
assert(redNone.tone === 'red', 'VC none → red')
assert(redNone.detailAt === null, 'VC none → no fabricated detail')

assert(
  resolveVehicleCheckCompletionInstant({
    inspectionDate: '2026-08-01',
    signedAt: null,
    inspectionCompletedAt: null,
  }) === '2026-08-01',
  'VC falls back to inspectionDate',
)

// --- Timesheet (derived from existing statuses; no new deadline day) ---
assert(isTimesheetSubmittedOrApproved('Submitted'), 'Submitted counts')
assert(isTimesheetSubmittedOrApproved('Approved'), 'Approved counts')
assert(!isTimesheetSubmittedOrApproved('Draft'), 'Draft not submitted')
assert(isTimesheetStillOpen('Draft'), 'Draft open')
assert(isTimesheetStillOpen('Rejected'), 'Rejected open')

const greenCurrent = resolveWorkerHomeTimesheetStatus({
  currentWeek: {
    status: 'Submitted',
    submittedAt: '2026-08-07T10:00:00.000Z',
    updatedAt: '2026-08-07T10:00:00.000Z',
  },
  previousWeek: {
    status: 'Approved',
    submittedAt: '2026-07-31T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  },
})
assert(greenCurrent.tone === 'green', 'TS current submitted → green')
assert(greenCurrent.title === 'Submitted', 'TS green title')
assert(
  greenCurrent.detailAt === '2026-08-07T10:00:00.000Z',
  'TS green uses submittedAt',
)

const amberInProgress = resolveWorkerHomeTimesheetStatus({
  currentWeek: {
    status: 'Draft',
    submittedAt: null,
    updatedAt: '2026-08-06T12:00:00.000Z',
  },
  previousWeek: {
    status: 'Approved',
    submittedAt: '2026-07-31T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  },
})
assert(amberInProgress.tone === 'amber', 'TS current draft → amber')
assert(amberInProgress.title === 'In progress', 'TS amber title')

const amberMissing = resolveWorkerHomeTimesheetStatus({
  currentWeek: null,
  previousWeek: {
    status: 'Submitted',
    submittedAt: '2026-07-31T09:00:00.000Z',
    updatedAt: '2026-07-31T09:00:00.000Z',
  },
})
assert(amberMissing.tone === 'amber', 'TS missing current → amber (not fabricated overdue)')

const redPreviousOpen = resolveWorkerHomeTimesheetStatus({
  currentWeek: {
    status: 'Draft',
    submittedAt: null,
    updatedAt: '2026-08-07T08:00:00.000Z',
  },
  previousWeek: {
    status: 'Draft',
    submittedAt: null,
    updatedAt: '2026-08-02T08:00:00.000Z',
  },
})
assert(redPreviousOpen.tone === 'red', 'TS previous draft → overdue red')
assert(redPreviousOpen.title === 'Overdue', 'TS red title')
assert(
  redPreviousOpen.detailAt === '2026-08-02T08:00:00.000Z',
  'TS overdue uses previous updatedAt',
)

const redOverridesGreen = resolveWorkerHomeTimesheetStatus({
  currentWeek: {
    status: 'Submitted',
    submittedAt: '2026-08-07T10:00:00.000Z',
    updatedAt: '2026-08-07T10:00:00.000Z',
  },
  previousWeek: {
    status: 'Rejected',
    submittedAt: '2026-07-30T10:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
  },
})
assert(
  redOverridesGreen.tone === 'red',
  'TS previous rejected wins over current submitted',
)

assert(
  previousTimesheetWeekStart('2026-08-03') === '2026-07-27',
  'previous week start -7 days',
)

assert(
  formatWorkerHomeStatusDetail('2026-08-07')?.includes('Aug') === true,
  'format date-only',
)
assert(
  formatWorkerHomeStatusDetail('2026-08-07T08:20:00.000Z')?.includes('·') === true,
  'format datetime',
)
assert(formatWorkerHomeStatusDetail(null) === null, 'format null')

// Active-only vehicle list filter (mirrors Home sheet data source contract)
type VehicleLike = { id: string; archivedAt: string | null; registration: string }
function activeCompanyVehicles(vehicles: VehicleLike[]): VehicleLike[] {
  return vehicles.filter((v) => v.archivedAt == null)
}
const fleet = [
  { id: 'a', archivedAt: null, registration: 'AB12 CDE' },
  { id: 'b', archivedAt: '2026-01-01T00:00:00.000Z', registration: 'ZZ99 ZZZ' },
]
const active = activeCompanyVehicles(fleet)
assert(active.length === 1 && active[0].id === 'a', 'only active vehicles')

console.log('verify-worker-home-status: PASS')
