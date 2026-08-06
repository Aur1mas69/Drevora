/**
 * Focused verification for Admin Worker “Change login email” UI wiring.
 * Run: npm run verify:worker-login-email-ui
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildChangeWorkerLoginEmailRequestBody,
  canSubmitChangeWorkerLoginEmail,
  changeWorkerLoginEmailRequestContainsForbiddenKeys,
  formatWorkerLoginEmailSuccessToast,
  formatWorkerLoginEmailUserMessage,
  isWorkerLoginEmailLocked,
  validateChangeWorkerLoginEmailInput,
} from '../src/lib/workerLoginEmail.ts'

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

const modal = read('src/components/workers/ChangeWorkerLoginEmailModal.tsx')
const formModal = read('src/components/workers/WorkerFormModal.tsx')
const service = read('src/services/workerLoginEmailService.ts')
const driversPage = read('src/pages/DriversPage.tsx')
const detailsPage = read('src/pages/DriverDetailsPage.tsx')
const driversService = read('src/services/driversService.ts')

run('1. Auth-linked lock helpers', () => {
  assertEqual(isWorkerLoginEmailLocked('11111111-1111-4111-8111-111111111111'), true, 'uuid locked')
  assertEqual(isWorkerLoginEmailLocked(null), false, 'null unlocked')
  assertEqual(isWorkerLoginEmailLocked(''), false, 'empty unlocked')
})

run('2. Confirm disabled until match + reason + checkbox', () => {
  assertEqual(
    canSubmitChangeWorkerLoginEmail({
      currentEmail: 'old@example.com',
      newEmail: 'new@example.com',
      confirmEmail: 'new@example.com',
      reason: 'Typo fix',
      samePersonConfirmed: true,
    }),
    true,
    'valid',
  )
  assertEqual(
    canSubmitChangeWorkerLoginEmail({
      currentEmail: 'old@example.com',
      newEmail: 'new@example.com',
      confirmEmail: 'other@example.com',
      reason: 'Typo fix',
      samePersonConfirmed: true,
    }),
    false,
    'mismatch',
  )
  assertEqual(
    canSubmitChangeWorkerLoginEmail({
      currentEmail: 'old@example.com',
      newEmail: 'new@example.com',
      confirmEmail: 'new@example.com',
      reason: '',
      samePersonConfirmed: true,
    }),
    false,
    'no reason',
  )
  assertEqual(
    canSubmitChangeWorkerLoginEmail({
      currentEmail: 'old@example.com',
      newEmail: 'new@example.com',
      confirmEmail: 'new@example.com',
      reason: 'Typo fix',
      samePersonConfirmed: false,
    }),
    false,
    'no checkbox',
  )
  assertEqual(
    canSubmitChangeWorkerLoginEmail({
      currentEmail: 'same@example.com',
      newEmail: 'same@example.com',
      confirmEmail: 'same@example.com',
      reason: 'noop',
      samePersonConfirmed: true,
    }),
    false,
    'same as current',
  )
})

run('3. Request body never includes companyId or authUserId', () => {
  const validated = validateChangeWorkerLoginEmailInput({
    workerId: '11111111-1111-4111-8111-111111111111',
    newEmail: 'New@Example.com',
    reason: 'Corrected email',
    samePersonConfirmed: true,
  })
  assertTrue(validated.ok, 'validated')
  if (!validated.ok) return
  const body = buildChangeWorkerLoginEmailRequestBody(validated.value)
  assertEqual(
    changeWorkerLoginEmailRequestContainsForbiddenKeys(body),
    false,
    'no forbidden keys',
  )
  assertEqual(Object.keys(body).sort().join(','), 'newEmail,reason,samePersonConfirmed,workerId', 'keys')
  assertEqual(body.samePersonConfirmed, true, 'confirmed')
  assertTrue(!('companyId' in body), 'no companyId')
  assertTrue(!('authUserId' in body), 'no authUserId')
})

run('4. Backend error codes map safely', () => {
  assertTrue(
    formatWorkerLoginEmailUserMessage('EMAIL_ALREADY_IN_USE').toLowerCase().includes('already in use'),
    'EMAIL_ALREADY_IN_USE',
  )
  assertTrue(
    formatWorkerLoginEmailUserMessage('WORKER_ARCHIVED').toLowerCase().includes('archived'),
    'WORKER_ARCHIVED',
  )
  assertTrue(
    formatWorkerLoginEmailUserMessage('WORKER_AUTH_NOT_LINKED').toLowerCase().includes('not linked'),
    'WORKER_AUTH_NOT_LINKED',
  )
  assertTrue(
    formatWorkerLoginEmailUserMessage('SAME_PERSON_CONFIRMATION_REQUIRED')
      .toLowerCase()
      .includes('same person'),
    'SAME_PERSON_CONFIRMATION_REQUIRED',
  )
  assertTrue(
    formatWorkerLoginEmailUserMessage('WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED')
      .toLowerCase()
      .includes('cannot be rebound'),
    'WORKER_IDENTITY_REPLACEMENT_NOT_ALLOWED',
  )
  assertTrue(
    formatWorkerLoginEmailUserMessage('FORBIDDEN').toLowerCase().includes('office'),
    'FORBIDDEN',
  )
  assertTrue(
    formatWorkerLoginEmailUserMessage('UNAUTHENTICATED').toLowerCase().includes('session'),
    'UNAUTHENTICATED',
  )
  assertTrue(
    !formatWorkerLoginEmailUserMessage(
      'server_failure',
      'SQL ERROR stack jwt service_role',
    )
      .toLowerCase()
      .includes('sql'),
    'no raw sql',
  )
})

run('5. Success toast mentions unchanged Worker ID/history', () => {
  const toast = formatWorkerLoginEmailSuccessToast({
    changed: true,
    email: 'new@example.com',
  })
  assertTrue(toast.includes('new@example.com'), 'email')
  assertTrue(toast.toLowerCase().includes('unchanged'), 'unchanged')
})

run('6. Service invokes change-worker-login-email only', () => {
  assertTrue(
    service.includes("'change-worker-login-email'"),
    'invoke function name',
  )
  assertTrue(
    service.includes('buildChangeWorkerLoginEmailRequestBody'),
    'uses shared body builder',
  )
  assertTrue(
    service.includes('changeWorkerLoginEmailRequestContainsForbiddenKeys'),
    'guards forbidden keys',
  )
})

run('7. Edit Worker locks linked email; Add stays editable', () => {
  assertTrue(formModal.includes('loginEmailLocked'), 'prop exists')
  assertTrue(formModal.includes('Change login email'), 'button label')
  assertTrue(formModal.includes('readOnly={loginEmailLocked}'), 'read-only when locked')
  assertTrue(driversPage.includes('emailRequired={!editingDriver}'), 'add requires email')
  assertTrue(
    driversPage.includes('isWorkerLoginEmailLocked(editingDriver?.authUserId)'),
    'list page locks from authUserId',
  )
  assertTrue(
    detailsPage.includes('isWorkerLoginEmailLocked(driver.authUserId)'),
    'details page locks from authUserId',
  )
  assertTrue(
    formModal.includes('Send account access email') &&
      driversPage.includes('onSendAccessEmail') &&
      detailsPage.includes('onSendAccessEmail'),
    'send access email available for linked Workers',
  )
})

run('8. Ordinary edit save preserves linked Worker email', () => {
  assertTrue(
    driversPage.includes('email: editingDriver.email'),
    'list page preserves email',
  )
  assertTrue(
    detailsPage.includes('email: driver.email'),
    'details page preserves email',
  )
  assertTrue(
    driversPage.includes('updatePayload') && detailsPage.includes('updatePayload'),
    'uses updatePayload for linked save',
  )
})

run('9. Drivers select/map auth_user_id', () => {
  assertTrue(driversService.includes('auth_user_id'), 'select includes column')
  assertTrue(driversService.includes('authUserId:'), 'maps authUserId')
  assertTrue(driversService.includes('authUserId: string | null'), 'Driver type')
})

run('10. Modal fields and confirmation checkbox present', () => {
  assertTrue(modal.includes('Current email'), 'current')
  assertTrue(modal.includes('New email'), 'new')
  assertTrue(modal.includes('Confirm new email'), 'confirm')
  assertTrue(modal.includes('Reason'), 'reason')
  assertTrue(
    modal.includes('I confirm this is the same person') &&
      modal.includes('the email address is') &&
      modal.includes('correct.'),
    'checkbox copy',
  )
  assertTrue(modal.includes('samePersonConfirmed: true'), 'sends true')
  assertTrue(modal.includes("disabled={!canSubmit || isSubmitting}"), 'confirm disabled')
})

console.log(`\nAll ${passed} checks passed.`)
