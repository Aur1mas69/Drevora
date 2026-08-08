/**
 * Focused verification: Office self-service TOTP factor removal.
 * Run: npm run verify:office-mfa-remove
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canRemoveOwnVerifiedTotpFactor,
  formatOfficeMfaStatusLabel,
  resolveMfaStatusAfterVerifiedFactorRemoval,
  resolveOfficeMfaGate,
  type OfficeMfaTotpFactor,
} from '../src/lib/officeMfa.ts'

let passed = 0

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function run(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function read(relative: string): string {
  return readFileSync(resolve(relative), 'utf8')
}

const factorA: OfficeMfaTotpFactor = {
  id: 'factor-a',
  friendlyName: 'Phone',
  status: 'verified',
  factorType: 'totp',
}

const factorB: OfficeMfaTotpFactor = {
  id: 'factor-b',
  friendlyName: 'Tablet',
  status: 'verified',
  factorType: 'totp',
}

const unverified: OfficeMfaTotpFactor = {
  id: 'factor-unverified',
  friendlyName: 'Incomplete',
  status: 'unverified',
  factorType: 'totp',
}

const service = read('src/services/mfaService.ts')
const settingsCard = read('src/components/settings/OfficeMfaSettingsCard.tsx')
const gateHook = read('src/hooks/useOfficeMfaGate.ts')

run('1. AAL2 user can remove own verified factor id from current list', () => {
  assertTrue(
    canRemoveOwnVerifiedTotpFactor({
      aal: 'aal2',
      factorId: 'factor-a',
      verifiedFactors: [factorA, factorB],
    }),
    'aal2 + listed verified id',
  )
})

run('2. AAL1 session cannot remove factor', () => {
  assertTrue(
    !canRemoveOwnVerifiedTotpFactor({
      aal: 'aal1',
      factorId: 'factor-a',
      verifiedFactors: [factorA],
    }),
    'aal1 blocked',
  )
  assertTrue(
    !canRemoveOwnVerifiedTotpFactor({
      aal: null,
      factorId: 'factor-a',
      verifiedFactors: [factorA],
    }),
    'null aal blocked',
  )
})

run('3. Arbitrary / stale factor IDs are rejected', () => {
  assertTrue(
    !canRemoveOwnVerifiedTotpFactor({
      aal: 'aal2',
      factorId: 'factor-not-mine',
      verifiedFactors: [factorA],
    }),
    'unknown id rejected',
  )
  assertTrue(
    !canRemoveOwnVerifiedTotpFactor({
      aal: 'aal2',
      factorId: 'factor-unverified',
      verifiedFactors: [factorA, unverified],
    }),
    'unverified id rejected even if present in broader list when not verified-filtered',
  )
  assertTrue(
    !canRemoveOwnVerifiedTotpFactor({
      aal: 'aal2',
      factorId: 'factor-unverified',
      verifiedFactors: [factorA],
    }),
    'unverified not in verifiedFactors',
  )
  assertTrue(
    !canRemoveOwnVerifiedTotpFactor({
      aal: 'aal2',
      factorId: '   ',
      verifiedFactors: [factorA],
    }),
    'blank id rejected',
  )
})

run('4. Removing one of multiple factors leaves MFA enabled', () => {
  const after = resolveMfaStatusAfterVerifiedFactorRemoval(1)
  assertEqual(after.statusLabel, 'Enabled', 'still enabled')
  assertEqual(after.requiresEnrollment, false, 'no enroll required')
  assertEqual(formatOfficeMfaStatusLabel(true), 'Enabled', 'label helper')
})

run('5. Removing last factor becomes Not configured and requires enrollment', () => {
  const after = resolveMfaStatusAfterVerifiedFactorRemoval(0)
  assertEqual(after.statusLabel, 'Not configured', 'unconfigured')
  assertEqual(after.requiresEnrollment, true, 'requires enrollment')

  const gate = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal2',
    factors: [],
  })
  assertEqual(gate.action, 'enroll', 'Office gate requires enroll again')
})

run('6. Service only unenrolls after AAL2 + verified-list check', () => {
  assertTrue(service.includes('unenrollOwnVerifiedTotpFactor'), 'service export')
  assertTrue(service.includes('canRemoveOwnVerifiedTotpFactor'), 'uses allowlist helper')
  assertTrue(service.includes("aal !== 'aal2'"), 'rejects non-aal2')
  assertTrue(service.includes('auth.mfa.unenroll'), 'calls unenroll')
  assertTrue(service.includes('isMfaFactorNotFoundError'), 'handles already-removed')
  assertTrue(
    !service.includes('console.log'),
    'no console logging secrets/tokens',
  )
})

run('7. Settings card requires confirmation modal before remove', () => {
  assertTrue(settingsCard.includes('Remove authenticator?'), 'modal title')
  assertTrue(settingsCard.includes('Remove authenticator'), 'remove action')
  assertTrue(settingsCard.includes('pendingRemove'), 'confirmation state')
  assertTrue(settingsCard.includes('unenrollOwnVerifiedTotpFactor'), 'service call')
  assertTrue(settingsCard.includes('canRemoveOwnVerifiedTotpFactor'), 'UI allowlist')
  assertTrue(settingsCard.includes('notifyOfficeMfaFactorsChanged'), 'notifies gate')
  assertTrue(settingsCard.includes('Add another authenticator'), 'keep add another')
})

run('8. Gate hook refreshes when MFA factors change event fires', () => {
  assertTrue(
    gateHook.includes('OFFICE_MFA_FACTORS_CHANGED_EVENT'),
    'listens for factors-changed',
  )
  assertTrue(gateHook.includes('refresh'), 'calls refresh')
})

console.log(`\nAll ${passed} checks passed.`)
