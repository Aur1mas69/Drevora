/**
 * Focused verification: Office self-service Pause/Resume and authenticator removal.
 * Run: npm run verify:office-mfa-remove
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canRemoveOwnVerifiedTotpFactor,
  formatOfficeMfaStatusLabel,
  mustPauseBeforeRemovingLastFactor,
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

function functionBody(source: string, marker: string, nextExport: string): string {
  const start = source.indexOf(marker)
  assertTrue(start >= 0, `missing ${marker}`)
  const end = source.indexOf(nextExport, start + marker.length)
  assertTrue(end > start, `unclosed ${marker}`)
  return source.slice(start, end)
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

run('2. AAL1 session cannot remove factor until challenged', () => {
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
      factorId: '   ',
      verifiedFactors: [factorA],
    }),
    'blank id rejected',
  )
})

run('4. Removing one of multiple factors keeps MFA On', () => {
  const after = resolveMfaStatusAfterVerifiedFactorRemoval({
    remainingVerifiedCount: 1,
    mfaEnabled: true,
  })
  assertEqual(after.statusLabel, 'On', 'still on')
  assertEqual(after.mfaEnabled, true, 'flag unchanged')
  assertEqual(after.requiresEnrollment, false, 'no enroll required')
  assertEqual(formatOfficeMfaStatusLabel(true), 'On', 'label helper')
  assertTrue(!mustPauseBeforeRemovingLastFactor(2), 'multiple does not pause first')
})

run('5. Removing last factor pauses before unenroll and does not force enrollment', () => {
  assertTrue(mustPauseBeforeRemovingLastFactor(1), 'last factor must pause first')
  const after = resolveMfaStatusAfterVerifiedFactorRemoval({
    remainingVerifiedCount: 0,
    mfaEnabled: true,
  })
  assertEqual(after.statusLabel, 'Off', 'off')
  assertEqual(after.mfaEnabled, false, 'paused')
  assertEqual(after.requiresEnrollment, false, 'does not require enrollment')

  const gate = resolveOfficeMfaGate({
    isOfficeRole: true,
    aal: 'aal1',
    factors: [factorA],
    mfaEnabled: false,
  })
  assertEqual(gate.action, 'allow', 'Paused with saved factor remains usable at AAL1')
})

run('6. Pause does not unenroll; Disable-unenroll helper is gone', () => {
  assertTrue(!service.includes('disableOwnOfficeMfa'), 'no disableOwnOfficeMfa')
  assertTrue(service.includes('pauseOwnOfficeMfa'), 'pause export')
  assertTrue(service.includes('resumeOwnOfficeMfa'), 'resume export')
  assertTrue(service.includes('removeOwnAuthenticator'), 'remove export')
  assertTrue(service.includes('getOfficeMfaEnabled'), 'read helper')
  assertTrue(
    service.includes('drevora_auth_set_own_office_mfa_enabled'),
    'set-own RPC',
  )
  assertTrue(
    service.includes('drevora_auth_office_mfa_is_enabled'),
    'is-enabled RPC',
  )

  const pauseBody = functionBody(
    service,
    'export async function pauseOwnOfficeMfa',
    'export async function resumeOwnOfficeMfa',
  )
  assertTrue(!pauseBody.includes('unenroll'), 'Pause does not unenroll')
  assertTrue(pauseBody.includes('p_enabled: false') || pauseBody.includes('setOwnOfficeMfaEnabled(false)'), 'sets false')

  const resumeBody = functionBody(
    service,
    'export async function resumeOwnOfficeMfa',
    'export async function removeOwnAuthenticator',
  )
  assertTrue(!resumeBody.includes('enrollTotpFactor'), 'Resume does not enroll')
  assertTrue(!resumeBody.includes('qr'), 'Resume does not create QR')
  assertTrue(resumeBody.includes("aal !== 'aal2'"), 'Resume requires AAL2')

  const removeBody = functionBody(
    service,
    'export async function removeOwnAuthenticator',
    'async function setOwnOfficeMfaEnabled',
  )
  const pauseIdx = removeBody.indexOf('pauseOwnOfficeMfa')
  const unenrollIdx = removeBody.indexOf('auth.mfa.unenroll')
  assertTrue(pauseIdx >= 0, 'last-factor path can pause')
  assertTrue(unenrollIdx >= 0, 'calls unenroll')
  assertTrue(pauseIdx < unenrollIdx, 'Pause before unenroll')
  assertTrue(removeBody.includes('mustPauseBeforeRemovingLastFactor'), 'last-factor guard')
  assertTrue(service.includes('isMfaFactorNotFoundError'), 'handles already-removed')
  assertTrue(!service.includes('console.log'), 'no console logging secrets/tokens')
})

run('7. Settings card: Disable=Pause, Enable=Resume, Remove is separate', () => {
  assertTrue(settingsCard.includes('Disable MFA?'), 'disable modal title')
  assertTrue(settingsCard.includes('Disable MFA'), 'disable action')
  assertTrue(settingsCard.includes('Enable MFA'), 'enable action')
  assertTrue(settingsCard.includes('pendingDisable'), 'disable confirmation state')
  assertTrue(settingsCard.includes('pauseOwnOfficeMfa'), 'pause service call')
  assertTrue(settingsCard.includes('resumeOwnOfficeMfa'), 'resume service call')
  assertTrue(settingsCard.includes('removeOwnAuthenticator'), 'per-factor remove')
  assertTrue(!settingsCard.includes('disableOwnOfficeMfa'), 'does not call old disable-unenroll')
  assertTrue(settingsCard.includes('notifyOfficeMfaFactorsChanged'), 'notifies gate')
  assertTrue(
    !settingsCard.includes('Add another authenticator'),
    'Add another authenticator is not offered in Settings',
  )
  assertTrue(settingsCard.includes('handleEnableMfa'), 'enable entrypoint')
  assertTrue(
    settingsCard.includes('Your authenticator stays saved') ||
      settingsCard.includes('authenticator stays saved'),
    'Pause copy keeps authenticator',
  )
  assertTrue(
    !settingsCard.includes('This removes your verified authenticator'),
    'Disable copy no longer claims unenroll',
  )

  const enableIdx = settingsCard.indexOf('async function handleEnableMfa')
  const enableBody = settingsCard.slice(
    enableIdx,
    settingsCard.indexOf('function requestRemoveFactor'),
  )
  assertTrue(enableBody.includes('verifiedCount === 0'), 'no-factor path enrolls')
  assertTrue(enableBody.includes('resumeOwnOfficeMfa'), 'existing factor resumes')
  assertTrue(
    enableBody.includes("setChallengeIntent('resume')") ||
      enableBody.includes('challengeIntent'),
    'AAL1 resume challenges existing factor',
  )

  const addIdx = settingsCard.indexOf('async function handleStartAddFactor')
  const addBody = settingsCard.slice(
    addIdx,
    settingsCard.indexOf('async function handleCancelEnrollment'),
  )
  assertTrue(addBody.includes('enrollTotpFactor'), 'no-factor Enable still enrolls')
  assertTrue(!addBody.includes('pauseOwnOfficeMfa'), 'enrollment does not pause MFA')
})

run('8. Gate hook refreshes when MFA factors change event fires', () => {
  assertTrue(
    gateHook.includes('OFFICE_MFA_FACTORS_CHANGED_EVENT'),
    'listens for factors-changed',
  )
  assertTrue(gateHook.includes('refresh'), 'calls refresh')
  assertTrue(gateHook.includes('getOfficeMfaEnabled'), 'reloads server flag')
})

run('9. Resume challenge failure cannot set mfa_enabled true first', () => {
  const resumeSettings = settingsCard.slice(
    settingsCard.indexOf('async function confirmChallenge'),
    settingsCard.indexOf('function cancelChallenge'),
  )
  const verifyIdx = resumeSettings.indexOf('challengeAndVerifyTotp')
  const resumeIdx = resumeSettings.indexOf('resumeOwnOfficeMfa')
  assertTrue(verifyIdx >= 0, 'challenges first')
  assertTrue(resumeIdx > verifyIdx, 'resume only after verify')
})

console.log(`\nAll ${passed} checks passed.`)
