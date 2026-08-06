/**
 * Focused verification for Admin Worker “Send account access email” UI wiring.
 * Run: npm run verify:worker-access-email-ui
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS,
  buildSendWorkerAccessEmailRequestBody,
  canShowSendWorkerAccessEmail,
  canSubmitSendWorkerAccessEmail,
  formatWorkerAccessEmailSuccessToast,
  formatWorkerAccessEmailUserMessage,
  sendWorkerAccessEmailRequestContainsForbiddenKeys,
  validateSendWorkerAccessEmailInput,
} from '../src/lib/workerAccessEmail.ts'
import { formatWorkerIdentityEventLabel } from '../src/lib/workerIdentityEvents.ts'

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

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n')
}

const modal = read('src/components/workers/SendWorkerAccessEmailModal.tsx')
const formModal = read('src/components/workers/WorkerFormModal.tsx')
const historyUi = read('src/components/workers/WorkerIdentityAccessHistory.tsx')
const service = read('src/services/workerAccessEmailService.ts')
const driversPage = read('src/pages/DriversPage.tsx')
const detailsPage = read('src/pages/DriverDetailsPage.tsx')
const changeLoginModal = read('src/components/workers/ChangeWorkerLoginEmailModal.tsx')

run('1. Request payload is only workerId + expectedEmail + emailConfirmed', () => {
  const validated = validateSendWorkerAccessEmailInput({
    workerId: '11111111-1111-4111-8111-111111111111',
    expectedEmail: '  Worker@Example.com ',
    emailConfirmed: true,
  })
  assertTrue(validated.ok, 'validated')
  if (!validated.ok) return
  const body = buildSendWorkerAccessEmailRequestBody(validated.value)
  assertEqual(
    Object.keys(body).sort().join(','),
    'emailConfirmed,expectedEmail,workerId',
    'keys',
  )
  assertEqual(body.emailConfirmed, true, 'confirmed')
  assertEqual(body.expectedEmail, 'worker@example.com', 'normalised email')
  assertEqual(
    sendWorkerAccessEmailRequestContainsForbiddenKeys(body),
    false,
    'no forbidden keys helper',
  )
  assertTrue(!('companyId' in body), 'no companyId')
  assertTrue(!('authUserId' in body), 'no authUserId')
  assertTrue(!('company_id' in body), 'no company_id')
  assertTrue(!('auth_user_id' in body), 'no auth_user_id')
})

run('2. Confirmation required before submit', () => {
  assertEqual(
    canSubmitSendWorkerAccessEmail({
      emailConfirmed: false,
      expectedEmail: 'worker@example.com',
    }),
    false,
    'unchecked',
  )
  assertEqual(
    canSubmitSendWorkerAccessEmail({
      emailConfirmed: true,
      expectedEmail: 'worker@example.com',
    }),
    true,
    'checked',
  )
  assertEqual(
    canSubmitSendWorkerAccessEmail({
      emailConfirmed: true,
      expectedEmail: 'not-an-email',
    }),
    false,
    'invalid email',
  )
  assertTrue(
    modal.includes('I confirm this email address belongs to this Worker') &&
      modal.includes('and is') &&
      modal.includes('correct.'),
    'checkbox copy',
  )
  assertTrue(modal.includes('disabled={!canSubmit || isSubmitting}'), 'confirm disabled')
  assertTrue(modal.includes('emailConfirmed: true'), 'sends true')
})

run('3. Double-submit protection while loading', () => {
  assertTrue(modal.includes('if (isSubmitting) return'), 'guard early return')
  assertTrue(modal.includes("disabled={!canSubmit || isSubmitting}"), 'submit disabled')
  assertTrue(modal.includes("disabled={isSubmitting}"), 'cancel/checkbox disabled path')
  assertTrue(modal.includes("Sending..."), 'loading label')
})

run('4. Service invokes send-worker-access-email only with shared body builder', () => {
  assertTrue(service.includes("'send-worker-access-email'"), 'invoke name')
  assertTrue(
    service.includes('buildSendWorkerAccessEmailRequestBody'),
    'shared body builder',
  )
  assertTrue(
    service.includes('sendWorkerAccessEmailRequestContainsForbiddenKeys'),
    'forbidden key guard',
  )
  assertTrue(
    !service.includes('companyId') || service.includes('Never send companyId'),
    'docs never companyId',
  )
  assertTrue(!service.includes('generateLink'), 'no generateLink')
})

run('5. Success refreshes Identity & Access History on details', () => {
  assertTrue(
    detailsPage.includes('setIdentityHistoryRefreshKey'),
    'refresh key exists',
  )
  assertTrue(
    detailsPage.includes('SendWorkerAccessEmailModal') &&
      detailsPage.includes('setIdentityHistoryRefreshKey((value) => value + 1)'),
    'access email success refreshes history',
  )
  assertTrue(
    detailsPage.includes('setToastMessage(result.toastMessage)'),
    'success toast',
  )
  assertTrue(
    formatWorkerAccessEmailSuccessToast('Worker@Example.com').includes(
      'worker@example.com',
    ),
    'toast includes email',
  )
})

run('6. Cooldown and structured error mapping', () => {
  assertTrue(
    formatWorkerAccessEmailUserMessage('ACCESS_EMAIL_RATE_LIMITED')
      .toLowerCase()
      .includes('cooldown'),
    'rate limited mentions cooldown',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('ACCESS_EMAIL_RATE_LIMITED', null, {
      retryAfterSeconds: WORKER_ACCESS_EMAIL_COOLDOWN_SECONDS,
    }).includes('15'),
    'retry after minutes',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('WORKER_LOGIN_EMAIL_OUT_OF_SYNC')
      .toLowerCase()
      .includes('do not match'),
    'out of sync',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('EMAIL_CONFIRMATION_MISMATCH')
      .toLowerCase()
      .includes('confirm'),
    'confirm mismatch',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('WORKER_AUTH_NOT_LINKED')
      .toLowerCase()
      .includes('not linked'),
    'not linked',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('WORKER_ARCHIVED')
      .toLowerCase()
      .includes('archived'),
    'archived',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('FORBIDDEN').toLowerCase().includes('office'),
    'forbidden',
  )
  assertTrue(
    formatWorkerAccessEmailUserMessage('UNAUTHENTICATED')
      .toLowerCase()
      .includes('session'),
    'unauthenticated',
  )
  assertTrue(
    !formatWorkerAccessEmailUserMessage(
      'server_failure',
      'SQL ERROR stack jwt service_role dispatch_id',
    )
      .toLowerCase()
      .includes('sql'),
    'no raw sql',
  )
  assertTrue(
    !formatWorkerAccessEmailUserMessage(
      'server_failure',
      'failed dispatch_id=abc auth_user_id=xyz company_id=1',
    ).includes('dispatch_id'),
    'no dispatch id leak via unsafe fallback',
  )
})

run('7. access_email_sent history label + details', () => {
  assertEqual(
    formatWorkerIdentityEventLabel('access_email_sent'),
    'Account access email sent',
    'label',
  )
  assertTrue(historyUi.includes("access_email_sent"), 'history handles event')
  assertTrue(historyUi.includes('Sent by'), 'actor label')
  assertTrue(historyUi.includes('Source'), 'source/reason')
})

run('8. Button shown only for Auth-linked Workers; Add invite unchanged', () => {
  assertEqual(
    canShowSendWorkerAccessEmail('11111111-1111-4111-8111-111111111111'),
    true,
    'linked',
  )
  assertEqual(canShowSendWorkerAccessEmail(null), false, 'unlinked null')
  assertEqual(canShowSendWorkerAccessEmail(''), false, 'unlinked empty')
  assertTrue(formModal.includes('Send account access email'), 'button label')
  assertTrue(formModal.includes('onSendAccessEmail'), 'prop')
  assertTrue(
    formModal.includes('Change login email') &&
      formModal.includes('Send account access email'),
    'beside change login email',
  )
  assertTrue(
    driversPage.includes('onSendAccessEmail={') &&
      driversPage.includes('isWorkerLoginEmailLocked(editingDriver.authUserId)'),
    'list page gated on auth link',
  )
  assertTrue(
    detailsPage.includes('onSendAccessEmail={') &&
      detailsPage.includes('isWorkerLoginEmailLocked(driver.authUserId)'),
    'details page gated on auth link',
  )
  assertTrue(
    driversPage.includes("emailRequired={!editingDriver}"),
    'add worker still requires email',
  )
  assertTrue(
    driversPage.includes('Add Worker & Send Invite'),
    'invite submit label preserved',
  )
  assertTrue(
    !changeLoginModal.includes('Send account access email'),
    'change login email modal unchanged',
  )
})

console.log(`\nAll ${passed} checks passed.`)
