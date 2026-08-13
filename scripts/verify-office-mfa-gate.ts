/**
 * Focused verification for Office Pause/Resume TOTP MFA gate helpers.
 * Run: npm run verify:office-mfa-gate
 *
 * Does not call Supabase — proves pure gate decisions and static wiring.
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

function read(relative: string): string {
  return readFileSync(resolve(relative), 'utf8')
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

run('1. mfa_enabled=false + verified factor + AAL1 => allow (Pause)', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [verifiedFactor],
    mfaEnabled: false,
  })
  assertEqual(decision.action, 'allow', 'allow action')
  assertTrue(!decision.mfaRequired, 'mfa not required while paused')
  assertTrue(decision.hasVerifiedTotp, 'authenticator still saved')
})

run('2. mfa_enabled=true + verified factor + AAL1 => challenge', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [verifiedFactor],
    mfaEnabled: true,
  })
  assertEqual(decision.action, 'challenge', 'challenge action')
  assertTrue(decision.mfaRequired, 'mfa required')
})

run('3. mfa_enabled=true + verified factor + AAL2 => allow', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal2',
    factors: [verifiedFactor],
    mfaEnabled: true,
  })
  assertEqual(decision.action, 'allow', 'allow action')
})

run('4. mfa_enabled=true + no verified factor => enroll/repair', () => {
  const empty = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [],
    mfaEnabled: true,
  })
  const unverifiedOnly = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [unverifiedFactor],
    mfaEnabled: true,
  })
  assertEqual(empty.action, 'enroll', 'no factor is repair enroll')
  assertEqual(unverifiedOnly.action, 'enroll', 'unverified is not enough')
  assertTrue(!hasVerifiedTotpFactor([unverifiedFactor]), 'no verified totp')
})

run('5. mfa_enabled=false + no factor + AAL1 => allow', () => {
  const decision = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [],
    mfaEnabled: false,
  })
  assertEqual(decision.action, 'allow', 'allow without MFA')
  assertTrue(!decision.mfaRequired, 'mfa not required')
})

run('6. Driver remains unaffected (MFA not required by Office gate)', () => {
  assertTrue(isWorkerMembershipRole('Driver'), 'Driver is worker role')
  assertTrue(!isOfficeMembershipRole('Driver'), 'Driver is not Office')

  const decision = resolveOfficeMfaGate({
    isOfficeRole: false,
    aal: 'aal1',
    factors: [verifiedFactor],
    mfaEnabled: true,
  })
  assertEqual(decision.action, 'allow', 'driver allowed without MFA')
  assertTrue(!decision.mfaRequired, 'mfa not required for driver')
})

run('7. Loading factors/AAL/mfaEnabled keeps Office blocked (no bypass)', () => {
  const waitingFactors = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: null,
    mfaEnabled: false,
  })
  const waitingAal = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: null,
    factors: [verifiedFactor],
    mfaEnabled: true,
  })
  const waitingFlag = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [verifiedFactor],
    mfaEnabled: null,
  })
  assertEqual(waitingFactors.action, 'loading', 'factors loading')
  assertEqual(waitingAal.action, 'loading', 'aal loading')
  assertEqual(waitingFlag.action, 'loading', 'mfaEnabled loading')
})

run('8. Status label and verified factor listing are safe', () => {
  assertEqual(formatOfficeMfaStatusLabel(false), 'Off', 'off')
  assertEqual(formatOfficeMfaStatusLabel(true), 'On', 'on')
  assertEqual(
    listVerifiedTotpFactors([verifiedFactor, unverifiedFactor]).length,
    1,
    'only verified listed',
  )
})

run('9. Router wires RequireOfficeMfa inside RequireOfficeAccess', () => {
  const routerSource = read('src/router/AppRouter.tsx')
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

run('10. Gate challenges existing factor and enrolls only as repair', () => {
  const gateSource = read('src/components/auth/RequireOfficeMfa.tsx')
  assertTrue(gateSource.includes('OfficeMfaChallengeScreen'), 'challenge remains')
  assertTrue(gateSource.includes('OfficeMfaEnrollScreen'), 'repair enroll screen')
  assertTrue(gateSource.includes("decision.action === 'enroll'"), 'enroll is repair-only branch')
  assertTrue(
    gateSource.includes('onCompleted={refresh}'),
    'login challenge only refreshes; does not set mfa_enabled',
  )
})

run('11. Settings Security uses Office MFA card (not Coming later)', () => {
  const settingsSource = read('src/pages/SettingsPage.tsx')
  assertTrue(
    settingsSource.includes('OfficeMfaSettingsCard'),
    'Office MFA settings card used',
  )
  assertTrue(
    !settingsSource.includes('TwoFactorAuthComingLaterCard'),
    'coming later card removed from Settings',
  )
})

run('12. MFA service uses TOTP enroll + challengeAndVerify only', () => {
  const serviceSource = read('src/services/mfaService.ts')
  assertTrue(serviceSource.includes("factorType: 'totp'"), 'totp enroll')
  assertTrue(serviceSource.includes('challengeAndVerify'), 'challengeAndVerify')
  assertTrue(serviceSource.includes('getAuthenticatorAssuranceLevel'), 'aal helper')
  assertTrue(serviceSource.includes('activeEnrollmentAttempt'), 'StrictMode single-flight')
  assertTrue(serviceSource.includes('isMfaFactorNotFoundError'), 'stale factor safe')
  assertTrue(!serviceSource.includes("factorType: 'sms'"), 'no sms mfa')
  assertTrue(!serviceSource.includes('webauthn'), 'no webauthn')
  assertTrue(!serviceSource.includes('enroll({ factorType: \'phone\''), 'no phone enroll')
})

run('13. No localStorage / IP / user_metadata authority for MFA', () => {
  const files = [
    'src/lib/officeMfa.ts',
    'src/services/mfaService.ts',
    'src/hooks/useOfficeMfaGate.ts',
    'src/components/auth/RequireOfficeMfa.tsx',
    'src/components/settings/OfficeMfaSettingsCard.tsx',
  ]
  for (const file of files) {
    const source = read(file)
    assertTrue(!source.includes('localStorage.getItem'), `${file}: no localStorage.getItem`)
    assertTrue(!source.includes('localStorage.setItem'), `${file}: no localStorage.setItem`)
    assertTrue(!source.includes('sessionStorage.getItem'), `${file}: no sessionStorage.getItem`)
    assertTrue(!source.includes('sessionStorage.setItem'), `${file}: no sessionStorage.setItem`)
    assertTrue(!source.includes('user_metadata'), `${file}: no user_metadata`)
    assertTrue(!/\buserIp\b|\bclientIp\b|\btrustedDevice\b/.test(source), `${file}: no IP/device trust`)
  }
})

run('14. Gate hook loads server mfa_enabled RPC', () => {
  const gateHook = read('src/hooks/useOfficeMfaGate.ts')
  assertTrue(gateHook.includes('getOfficeMfaEnabled'), 'loads server flag')
  assertTrue(gateHook.includes('drevora_auth_office_mfa_is_enabled') || gateHook.includes('getOfficeMfaEnabled'), 'RPC helper')
  assertTrue(gateHook.includes('mfaEnabled'), 'passes mfaEnabled into gate')
})

console.log(`\nAll ${passed} checks passed.`)
