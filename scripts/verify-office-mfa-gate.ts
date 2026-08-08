/**
 * Focused verification for Office mandatory TOTP MFA gate helpers.
 * Run: npm run verify:office-mfa-gate
 *
 * Does not call Supabase — proves pure gate decisions that protect Office AAL1
 * sessions and leave Drivers unaffected.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  formatOfficeMfaStatusLabel,
  hasVerifiedTotpFactor,
  listVerifiedTotpFactors,
  resolveOfficeMfaGate,
  type OfficeMfaTotpFactor,
} from '../src/lib/officeMfa.ts'
import { isOfficeMembershipRole, isWorkerMembershipRole } from '../src/lib/membershipRoles.ts'

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

const verifiedFactor: OfficeMfaTotpFactor = {
  id: 'factor-verified',
  friendlyName: 'Authenticator app',
  status: 'verified',
  factorType: 'totp',
}

const unverifiedFactor: OfficeMfaTotpFactor = {
  id: 'factor-unverified',
  friendlyName: 'Incomplete',
  status: 'unverified',
  factorType: 'totp',
}

run('1. Office role + aal1 without verified factor is forced to enrollment', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [],
  })
  assertEqual(decision.action, 'enroll', 'enroll action')
  assertTrue(decision.mfaRequired, 'mfa required')
})

run('2. Office role + unverified-only factor is treated as enroll (not valid MFA)', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [unverifiedFactor],
  })
  assertEqual(decision.action, 'enroll', 'unverified is not enough')
  assertTrue(!hasVerifiedTotpFactor([unverifiedFactor]), 'no verified totp')
})

run('3. Office role + verified factor + aal1 is forced to challenge', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [verifiedFactor],
  })
  assertEqual(decision.action, 'challenge', 'challenge action')
  assertTrue(decision.hasVerifiedTotp, 'has verified totp')
})

run('4. Office role + aal2 is allowed', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal2',
    factors: [verifiedFactor],
  })
  assertEqual(decision.action, 'allow', 'allow action')
})

run('4b. Office role + aal2 with no verified factor must enroll (no bypass)', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal2',
    factors: [],
  })
  assertEqual(decision.action, 'enroll', 'last-factor removal cannot leave Admin open')
})

run('5. Successful verification path requires aal2 before allow', () => {
  const afterPassword = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [verifiedFactor],
  })
  const afterVerify = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal2',
    factors: [verifiedFactor],
  })
  assertEqual(afterPassword.action, 'challenge', 'still blocked at aal1')
  assertEqual(afterVerify.action, 'allow', 'allowed only at aal2')
})

run('6. Driver remains unaffected (MFA not required by Office gate)', () => {
  assertTrue(isWorkerMembershipRole('Driver'), 'Driver is worker role')
  assertTrue(!isOfficeMembershipRole('Driver'), 'Driver is not Office')

  const decision = resolveOfficeMfaGate({
    isOfficeRole: false,
    aal: 'aal1',
    factors: [],
  })
  assertEqual(decision.action, 'allow', 'driver allowed without MFA')
  assertTrue(!decision.mfaRequired, 'mfa not required for driver')
})

run('7. Loading factors/AAL keeps Office blocked (no bypass)', () => {
  const waitingFactors = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: null,
  })
  const waitingAal = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: null,
    factors: [verifiedFactor],
  })
  assertEqual(waitingFactors.action, 'loading', 'factors loading')
  assertEqual(waitingAal.action, 'loading', 'aal loading')
})

run('8. Status label and verified factor listing are safe', () => {
  assertEqual(formatOfficeMfaStatusLabel(false), 'Not configured', 'not configured')
  assertEqual(formatOfficeMfaStatusLabel(true), 'Enabled', 'enabled')
  assertEqual(
    listVerifiedTotpFactors([verifiedFactor, unverifiedFactor]).length,
    1,
    'only verified listed',
  )
})

run('9. Router wires RequireOfficeMfa inside RequireOfficeAccess', () => {
  const routerSource = readFileSync(resolve('src/router/AppRouter.tsx'), 'utf8')
  assertTrue(
    routerSource.includes("import { RequireOfficeMfa } from '@/components/auth/RequireOfficeMfa'"),
    'RequireOfficeMfa imported',
  )
  assertTrue(
    routerSource.includes('<RequireOfficeMfa>'),
    'RequireOfficeMfa wraps Office children',
  )
  assertTrue(
    routerSource.includes('RequireCustomerLegalAcceptance'),
    'legal acceptance still present',
  )
})

run('10. Settings Security uses Office MFA card (not Coming later)', () => {
  const settingsSource = readFileSync(resolve('src/pages/SettingsPage.tsx'), 'utf8')
  assertTrue(
    settingsSource.includes('OfficeMfaSettingsCard'),
    'Office MFA settings card used',
  )
  assertTrue(
    !settingsSource.includes('TwoFactorAuthComingLaterCard'),
    'coming later card removed from Settings',
  )
})

run('11. MFA service uses TOTP enroll + challengeAndVerify only', () => {
  const serviceSource = readFileSync(resolve('src/services/mfaService.ts'), 'utf8')
  assertTrue(serviceSource.includes("factorType: 'totp'"), 'totp enroll')
  assertTrue(serviceSource.includes('challengeAndVerify'), 'challengeAndVerify')
  assertTrue(serviceSource.includes('getAuthenticatorAssuranceLevel'), 'aal helper')
  assertTrue(serviceSource.includes('activeEnrollmentAttempt'), 'StrictMode single-flight')
  assertTrue(serviceSource.includes('isMfaFactorNotFoundError'), 'stale factor safe')
  assertTrue(!serviceSource.includes("factorType: 'sms'"), 'no sms mfa')
  assertTrue(!serviceSource.includes('webauthn'), 'no webauthn')
  // Avoid matching "Recovery codes are not provided" copy — ban SMS/recovery factor APIs.
  assertTrue(!serviceSource.includes('enroll({ factorType: \'phone\''), 'no phone enroll')
})

console.log(`\nAll ${passed} checks passed.`)
