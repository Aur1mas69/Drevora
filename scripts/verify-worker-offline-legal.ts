/**
 * Regression checks for Worker offline legal-acceptance after document_version bumps.
 * Run: npx tsx scripts/verify-worker-offline-legal.ts
 */
import {
  classifyWorkerLegalAccessState,
  shouldDeferWorkerLegalUpdate,
  type WorkerLegalLocalSummary,
} from '../src/lib/legalAcceptanceTypes.ts'
import {
  isWorkerActiveCheckSession,
  setWorkerActiveCheckSession,
} from '../src/lib/workerActiveCheckSession.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function summary(overrides: Partial<WorkerLegalLocalSummary> = {}): WorkerLegalLocalSummary {
  return {
    companyId: 'company-1',
    driverId: 'driver-1',
    workerTermsVersion: '0.1',
    workerTermsAccepted: true,
    privacyVersion: '0.2',
    privacyAcknowledged: true,
    acceptedAt: '2026-07-01T10:00:00.000Z',
    cachedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }
}

const companyId = 'company-1'

// 1. Accepted version A → version B published → offline → Vehicle Checks allowed.
{
  const state = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: summary({ workerTermsVersion: '0.1', privacyVersion: '0.2' }),
  })
  assert(state === 'accepted_previous', `expected accepted_previous, got ${state}`)
  assert(
    state !== 'never_accepted',
    'version bump must not erase previous acceptance proof',
  )
  console.log('PASS 1: accepted_previous offline allows Vehicle Checks soft-pass')
}

// 2. Same Worker online → latest Terms required (not deferred without active check).
{
  const offlineState = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: summary({ workerTermsVersion: '0.1', privacyVersion: '0.2' }),
  })
  assert(offlineState === 'accepted_previous', `expected accepted_previous, got ${offlineState}`)
  const defer = shouldDeferWorkerLegalUpdate({
    requiresLatestAcceptance: true,
    isOnline: true,
    hasActiveCheck: false,
    offlineState,
  })
  assert(!defer, 'online without active check must require latest Terms immediately')
  console.log('PASS 2: online accepted_previous requires latest Terms')
}

// 3. Never accepted → offline → blocked.
{
  const state = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: null,
  })
  assert(state === 'never_accepted', `expected never_accepted, got ${state}`)
  console.log('PASS 3: never_accepted offline is blocked')
}

// 4. Network request fails → not misclassified as never accepted.
{
  const state = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: null,
    treatMissingAsUnavailable: true,
  })
  assert(state === 'unavailable_offline', `expected unavailable_offline, got ${state}`)
  assert(state !== 'never_accepted', 'network failure must not look like never_accepted')

  const withPrevious = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: summary({ workerTermsVersion: '0.1', privacyVersion: '0.2' }),
    treatMissingAsUnavailable: true,
  })
  assert(
    withPrevious === 'accepted_previous',
    `network failure with cache should stay accepted_previous, got ${withPrevious}`,
  )
  console.log('PASS 4: network failure is unavailable_offline / keeps previous proof')
}

// 5. Reconnect during active check → no interruption (defer Terms).
{
  setWorkerActiveCheckSession(true)
  assert(isWorkerActiveCheckSession() === true, 'active check session should be set')

  const offlineState = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: summary({ workerTermsVersion: '0.1', privacyVersion: '0.2' }),
  })
  const defer = shouldDeferWorkerLegalUpdate({
    requiresLatestAcceptance: true,
    isOnline: true,
    hasActiveCheck: isWorkerActiveCheckSession(),
    offlineState,
  })
  assert(defer === true, 'reconnect during active check must defer Terms')

  setWorkerActiveCheckSession(false)
  const deferAfter = shouldDeferWorkerLegalUpdate({
    requiresLatestAcceptance: true,
    isOnline: true,
    hasActiveCheck: isWorkerActiveCheckSession(),
    offlineState,
  })
  assert(deferAfter === false, 'after check ends, Terms must be required')
  console.log('PASS 5: reconnect during active check defers Terms until complete')
}

// Extra: exact match remains accepted_latest; cache is not upgraded by classifier.
{
  const cached = summary({ workerTermsVersion: '0.2', privacyVersion: '0.3' })
  const state = classifyWorkerLegalAccessState({
    companyId,
    bundledWorkerTermsVersion: '0.2',
    bundledPrivacyVersion: '0.3',
    summary: cached,
  })
  assert(state === 'accepted_latest', `expected accepted_latest, got ${state}`)
  assert(cached.workerTermsVersion === '0.2', 'classifier must not mutate cached version')
  console.log('PASS extra: accepted_latest match; cache unchanged')
}

console.log('\nAll Worker offline legal regression checks passed.')
