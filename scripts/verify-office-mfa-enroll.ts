/**
 * Focused verification: Office TOTP enrollment must be StrictMode-safe and
 * must not surface "Factor not found" from stale unverified cleanup.
 * Run: npm run verify:office-mfa-enroll
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isMfaFactorNotFoundError } from '../src/lib/officeMfa.ts'

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

const service = read('src/services/mfaService.ts')
const enrollScreen = read('src/components/auth/OfficeMfaEnrollScreen.tsx')

run('1. isMfaFactorNotFoundError treats missing factor as non-fatal', () => {
  assertTrue(
    isMfaFactorNotFoundError({ code: 'mfa_factor_not_found', message: 'Factor not found' }),
    'code mfa_factor_not_found',
  )
  assertTrue(
    isMfaFactorNotFoundError({ message: 'Factor not found' }),
    'message Factor not found',
  )
  assertTrue(
    !isMfaFactorNotFoundError({ code: 'unexpected_failure', message: 'boom' }),
    'other errors remain fatal',
  )
})

run('2. clearUnverifiedTotpFactors ignores factor-not-found (does not throw it up)', () => {
  assertTrue(service.includes('isMfaFactorNotFoundError(error)'), 'uses helper')
  assertTrue(service.includes('continue'), 'continues on not-found')
  const clearIdx = service.indexOf('export async function clearUnverifiedTotpFactors')
  const clearBody = service.slice(clearIdx, service.indexOf('async function enrollTotpFactorOnce'))
  assertTrue(clearBody.includes('unenroll'), 'calls unenroll')
  assertTrue(clearBody.includes('isMfaFactorNotFoundError'), 'guards not-found')
  assertTrue(
    clearBody.includes("factor.status === 'unverified'"),
    'only unverified factors',
  )
  assertTrue(!clearBody.includes("status === 'verified'"), 'does not target verified')
})

run('3. enrollTotpFactor single-flights one enroll attempt (StrictMode-safe)', () => {
  assertTrue(service.includes('activeEnrollmentAttempt'), 'shared attempt state')
  assertTrue(
    service.includes('activeEnrollmentAttempt.friendlyName === name'),
    'reuses same attempt',
  )
  assertTrue(service.includes('discardActiveTotpEnrollmentAttempt'), 'discard helper')
  // Only one mfa.enroll call site for TOTP start
  const enrollCalls = service.match(/auth\.mfa\.enroll\(/g) ?? []
  assertEqual(enrollCalls.length, 1, 'single auth.mfa.enroll call site')
})

run('4. Enrollment UI verifies with enroll response factorId (not listFactors)', () => {
  assertTrue(
    enrollScreen.includes('factorId: enrollment.factorId'),
    'uses enrollment.factorId',
  )
  assertTrue(!enrollScreen.includes('listTotpFactors'), 'no listFactors in enroll screen')
  assertTrue(!enrollScreen.includes('listFactors'), 'no listFactors')
  assertTrue(
    enrollScreen.includes('enrollTotpFactor('),
    'starts via enrollTotpFactor',
  )
})

run('5. Successful verify discards active attempt; invalid code stays on same factor', () => {
  assertTrue(
    enrollScreen.includes('discardActiveTotpEnrollmentAttempt()'),
    'discards after success',
  )
  const verifyIdx = enrollScreen.indexOf('async function handleVerify')
  assertTrue(verifyIdx >= 0, 'handleVerify present')
  const verifyBody = enrollScreen.slice(
    verifyIdx,
    enrollScreen.indexOf('<OfficeMfaShell', verifyIdx),
  )
  assertTrue(
    verifyBody.includes('verifyTotpEnrollment'),
    'verifies enrollment',
  )
  assertTrue(
    !verifyBody.includes('enrollTotpFactor'),
    'does not re-enroll on bad code',
  )
})

run('6. QR/secret come from enroll response fields only', () => {
  assertTrue(enrollScreen.includes('enrollment.qrCode'), 'renders qr from enroll')
  assertTrue(enrollScreen.includes('enrollment.secret'), 'renders secret from enroll')
  assertTrue(service.includes('totp?.qr_code'), 'maps qr_code')
  assertTrue(service.includes('totp?.secret'), 'maps secret')
  assertTrue(service.includes('data?.id'), 'maps factor id')
})

run('7. No secret/QR/token logging in MFA enrollment path', () => {
  for (const [name, source] of [
    ['mfaService', service],
    ['OfficeMfaEnrollScreen', enrollScreen],
  ] as const) {
    assertTrue(!source.includes('console.log'), `${name}: no console.log`)
    assertTrue(!source.includes('console.info'), `${name}: no console.info`)
    assertTrue(!source.includes('console.debug'), `${name}: no console.debug`)
  }
})

run('8. Verified factors are never unenrolled by clearUnverified', () => {
  const clearIdx = service.indexOf('export async function clearUnverifiedTotpFactors')
  const clearBody = service.slice(
    clearIdx,
    service.indexOf('async function enrollTotpFactorOnce'),
  )
  assertTrue(
    clearBody.includes("factor.status === 'unverified'"),
    'filters unverified only',
  )
  assertTrue(
    !/unenroll\(\{\s*factorId:\s*[^}]*verified/.test(clearBody),
    'no verified unenroll path',
  )
})

console.log(`\nAll ${passed} checks passed.`)
