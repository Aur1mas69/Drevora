/**
 * Verifies shared subscription expiry entitlement rules.
 * Run: npx tsx scripts/verify-subscription-entitlement.ts
 */
import {
  getSubscriptionDaysRemaining,
  isSubscriptionExpiredAt,
  resolveSubscriptionEntitlement,
} from '../src/lib/subscriptionEntitlement'
import type { CompanyPlanRecord } from '../src/services/companyPlanService'
import { buildVehicleAllowanceSnapshot } from '../src/lib/vehicleAllowance'
import { buildWorkerAllowanceSnapshot } from '../src/lib/workerAllowance'
import { getSubscriptionPlan } from '../src/lib/subscriptionPlans'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exitCode = 1
    return
  }
  console.log(`PASS: ${message}`)
}

const growing = getSubscriptionPlan('growing')

function plan(overrides: Partial<CompanyPlanRecord> = {}): CompanyPlanRecord {
  return {
    planCode: 'growing',
    planSelectedAt: '2026-07-01T00:00:00.000Z',
    trialStartedAt: '2026-07-01T00:00:00.000Z',
    subscriptionStatus: 'trial',
    subscriptionValidUntil: '2026-08-21T12:00:00.000Z',
    definition: growing,
    ...overrides,
  }
}

const now = new Date('2026-07-22T12:00:00.000Z')

// Case 1: future expiry — active
const future = plan({ subscriptionValidUntil: '2026-08-21T12:00:00.000Z' })
const active = resolveSubscriptionEntitlement(future, now)
assert(active.lifecycleState === 'active', 'Case 1 lifecycle active')
assert(active.isExpired === false, 'Case 1 not expired')
assert(active.canCreateEntitledRecords === true, 'Case 1 can create')
assert(active.daysRemaining === 30, 'Case 1 days remaining = 30')
assert(active.subscriptionStatus === 'trial', 'Case 1 stored status remains trial')

const vehicleActive = buildVehicleAllowanceSnapshot({
  vehicles: [],
  plan: future,
  now,
})
assert(vehicleActive.canAddVehicle === true, 'Case 1 can add Vehicle')
assert(vehicleActive.blockReason == null, 'Case 1 no vehicle block')

const workerActive = buildWorkerAllowanceSnapshot({
  drivers: [],
  plan: future,
  now,
})
assert(workerActive.canAddWorker === true, 'Case 1 can add Worker')

// Case 2: expired yesterday
const expiredPlan = plan({ subscriptionValidUntil: '2026-07-21T12:00:00.000Z' })
const expired = resolveSubscriptionEntitlement(expiredPlan, now)
assert(expired.lifecycleState === 'expired', 'Case 2 lifecycle expired')
assert(expired.isExpired === true, 'Case 2 isExpired')
assert(expired.canCreateEntitledRecords === false, 'Case 2 cannot create')
assert(expired.subscriptionStatus === 'trial', 'Case 2 stored status still trial')

const vehicleExpired = buildVehicleAllowanceSnapshot({
  vehicles: [],
  plan: expiredPlan,
  now,
})
assert(vehicleExpired.canAddVehicle === false, 'Case 2 Add Vehicle blocked')
assert(vehicleExpired.blockReason === 'expired', 'Case 2 vehicle blockReason expired')
assert(
  vehicleExpired.detail?.includes('Contact DREVORA') === true,
  'Case 2 vehicle expiry message',
)

const workerExpired = buildWorkerAllowanceSnapshot({
  drivers: [],
  plan: expiredPlan,
  now,
})
assert(workerExpired.canAddWorker === false, 'Case 2 Add Worker blocked')
assert(workerExpired.blockReason === 'expired', 'Case 2 worker blockReason expired')

// Case 3: exactly now — expired
const exact = '2026-07-22T12:00:00.000Z'
assert(isSubscriptionExpiredAt(exact, now) === true, 'Case 3 exact now is expired')
assert(
  resolveSubscriptionEntitlement(plan({ subscriptionValidUntil: exact }), now)
    .lifecycleState === 'expired',
  'Case 3 entitlement expired at exact now',
)

// Case 4: null valid-until — preserve behaviour
const noExpiry = plan({ subscriptionValidUntil: null })
const nullEntitlement = resolveSubscriptionEntitlement(noExpiry, now)
assert(nullEntitlement.lifecycleState === 'no_expiry_set', 'Case 4 no_expiry_set')
assert(nullEntitlement.isExpired === false, 'Case 4 not expired')
assert(nullEntitlement.canCreateEntitledRecords === true, 'Case 4 can create')
assert(nullEntitlement.daysRemaining == null, 'Case 4 days remaining null')
assert(getSubscriptionDaysRemaining(null, now) == null, 'Case 4 helper null')

const vehicleNull = buildVehicleAllowanceSnapshot({
  vehicles: [],
  plan: noExpiry,
  now,
})
assert(vehicleNull.canAddVehicle === true, 'Case 4 vehicle create still allowed')

if (process.exitCode) {
  process.exit(process.exitCode)
}
console.log('All subscription entitlement cases passed')
