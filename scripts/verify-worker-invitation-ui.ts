/**
 * Focused verification for Admin Add Worker → invite-worker UI wiring.
 * Run: npm run verify:worker-invitation-ui
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
  buildInviteWorkerRequestBody,
  classifyInviteWorkerSuccess,
  formatInviteWorkerAvatarFailureToast,
  formatInviteWorkerSuccessToast,
  formatInviteWorkerUserMessage,
  inviteWorkerRequestContainsCompanyId,
  normalizeInvitationEmail,
  parseFunctionsInvokeErrorBody,
} from '../src/lib/workerInvitation.ts'

let passed = 0

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`)
  }
}

function assertTrue(value: boolean, message: string) {
  if (!value) throw new Error(message)
}

function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed += 1
      console.log(`PASS  ${name}`)
    })
}

const driversPageSource = readFileSync(
  resolve('src/pages/DriversPage.tsx'),
  'utf8',
)

async function main() {
  await run('1. New Worker create path uses inviteWorker (not createDriver)', () => {
    assertTrue(
      driversPageSource.includes("from '@/services/workerInvitationService'"),
      'imports workerInvitationService',
    )
    assertTrue(
      driversPageSource.includes('inviteWorker(form)'),
      'calls inviteWorker(form)',
    )
    assertTrue(
      !driversPageSource.includes('driversService.createDriver'),
      'does not call driversService.createDriver',
    )
  })

  await run('2. Edit flow still uses driversService.updateDriver', () => {
    assertTrue(
      driversPageSource.includes('driversService.updateDriver('),
      'edit uses updateDriver',
    )
  })

  await run('3. Email is required for create (not optional)', () => {
    assertTrue(
      driversPageSource.includes('requireEmail: !isEdit'),
      'requireEmail on create',
    )
    assertTrue(
      driversPageSource.includes('emailRequired={!editingDriver}'),
      'emailRequired prop on modal',
    )
    assertEqual(
      normalizeInvitationEmail('  Alex@Example.COM '),
      'alex@example.com',
      'email normalised',
    )
  })

  await run('4. Request body never includes companyId', () => {
    const body = buildInviteWorkerRequestBody({
      email: 'Worker@Example.com',
      firstName: 'Sam',
      lastName: 'Driver',
      role: 'Driver',
      status: 'Off Duty',
      phone: '07000',
      companyId: 'should-not-appear',
      company: 'Acme',
    })
    assertEqual(
      inviteWorkerRequestContainsCompanyId(body),
      false,
      'no companyId key',
    )
    assertEqual(
      Object.prototype.hasOwnProperty.call(body, 'companyId'),
      false,
      'companyId absent',
    )
    assertEqual(body.email, 'worker@example.com', 'email lowercased')
    assertEqual(body.operationalRole, 'Driver', 'operational role mapped')
  })

  await run('5. Email-delivery-failed response is created-with-warning', () => {
    const kind = classifyInviteWorkerSuccess({
      code: 'linked_email_failed',
      inviteSent: false,
      emailDeliveryFailed: true,
    })
    assertEqual(kind, 'created_email_failed', 'kind')
    const toast = formatInviteWorkerSuccessToast(kind, 'A2B3C')
    assertTrue(toast.toLowerCase().includes('could not be sent'), 'warning toast')
  })

  await run('6. Duplicate submit protection is present', () => {
    assertTrue(
      driversPageSource.includes('if (isCreating || isAvatarUploading) return'),
      'early return while submitting',
    )
    assertTrue(
      driversPageSource.includes("'Add Worker & Send Invite'"),
      'invite submit label',
    )
  })

  await run('7. Backend error codes map to clear user messages', () => {
    assertEqual(
      formatInviteWorkerUserMessage(USER_ALREADY_LINKED_TO_ANOTHER_COMPANY),
      'This email already belongs to an active account in another company.',
      'other company',
    )
    assertTrue(
      formatInviteWorkerUserMessage('plan_limit_reached').includes('allowance'),
      'plan limit',
    )
    assertTrue(
      !formatInviteWorkerUserMessage(
        'server_failure',
        'SQL ERROR stack jwt service_role',
      )
        .toLowerCase()
        .includes('sql'),
      'no raw sql',
    )
  })

  await run(
    '8. Successful invitation + avatar failure is created-with-warning',
    () => {
      const toast = formatInviteWorkerAvatarFailureToast('invited')
      assertEqual(
        toast,
        'Worker was added and invited, but the profile photo could not be uploaded.',
        'avatar warning copy',
      )
      assertTrue(
        driversPageSource.includes('formatInviteWorkerAvatarFailureToast'),
        'DriversPage uses avatar failure toast helper',
      )
      assertTrue(
        driversPageSource.includes('finishInviteCreate'),
        'create path finishes invite success helper',
      )

      const inviteStart = driversPageSource.indexOf(
        'const inviteResult = await inviteWorker',
      )
      const editAvatarMarker = driversPageSource.indexOf(
        "setToastMessage('Worker updated, but avatar upload failed.')",
      )
      assertTrue(inviteStart >= 0 && editAvatarMarker > inviteStart, 'markers')
      const inviteSection = driversPageSource.slice(inviteStart, editAvatarMarker)

      assertTrue(
        inviteSection.includes('formatInviteWorkerAvatarFailureToast'),
        'create path avatar failure uses warning toast',
      )
      assertTrue(
        inviteSection.includes('await finishInviteCreate('),
        'create path closes via finishInviteCreate',
      )
      assertTrue(
        !inviteSection.includes(
          "setAvatarError(\n              'Worker saved, but the avatar upload failed",
        ),
        'create path does not leave modal avatar error',
      )
    },
  )

  await run('9. Non-2xx structured function body preserves backend code', async () => {
    let textReads = 0
    const response = {
      bodyUsed: false,
      async text() {
        textReads += 1
        this.bodyUsed = true
        return JSON.stringify({
          ok: false,
          code: USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
          message: 'linked elsewhere',
        })
      },
    }

    const parsed = await parseFunctionsInvokeErrorBody({
      error: { message: 'Edge Function returned a non-2xx status code', context: response },
    })
    assertEqual(parsed.structured, true, 'structured')
    assertEqual(
      parsed.code,
      USER_ALREADY_LINKED_TO_ANOTHER_COMPANY,
      'preserves code',
    )
    assertEqual(parsed.message, 'linked elsewhere', 'message')
    assertEqual(textReads, 1, 'body read once')
    assertEqual(parsed.bodyConsumed, true, 'consumed flag')
  })

  await run('10. Malformed/non-JSON function error falls back safely', async () => {
    const html = await parseFunctionsInvokeErrorBody({
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: {
          bodyUsed: false,
          async text() {
            return '<!DOCTYPE html><html><body>gateway timeout</body></html>'
          },
        },
      },
    })
    assertEqual(html.structured, false, 'not structured')
    assertEqual(html.code, 'server_failure', 'generic code')
    assertEqual(html.message, null, 'no raw html message')

    const junk = await parseFunctionsInvokeErrorBody({
      error: {
        message: 'boom',
        context: {
          bodyUsed: false,
          async text() {
            return 'not-json {{{ SQL EXCEPTION service_role'
          },
        },
      },
    })
    assertEqual(junk.code, 'server_failure', 'junk → generic')
    assertEqual(junk.message, null, 'no raw internals')
  })

  await run('11. Response body is not consumed multiple times', async () => {
    let textReads = 0
    const response = {
      bodyUsed: false,
      async text() {
        textReads += 1
        if (this.bodyUsed) {
          throw new Error('body already used')
        }
        this.bodyUsed = true
        return JSON.stringify({ code: 'forbidden', message: 'Office only' })
      },
    }

    const first = await parseFunctionsInvokeErrorBody({
      error: { context: response },
    })
    assertEqual(first.code, 'forbidden', 'first parse')
    assertEqual(textReads, 1, 'one read')

    const second = await parseFunctionsInvokeErrorBody({
      error: { context: response },
    })
    assertEqual(second.code, 'server_failure', 'second uses bodyUsed short-circuit')
    assertEqual(textReads, 1, 'no second read')
    assertEqual(second.bodyConsumed, true, 'marked consumed')
  })

  await run('12. Prefer structured data payload without re-reading body', async () => {
    let textReads = 0
    const parsed = await parseFunctionsInvokeErrorBody({
      data: {
        ok: false,
        code: 'duplicate_worker',
        message: 'exists',
      },
      error: {
        context: {
          bodyUsed: false,
          async text() {
            textReads += 1
            return 'should-not-read'
          },
        },
      },
    })
    assertEqual(parsed.code, 'duplicate_worker', 'from data')
    assertEqual(parsed.structured, true, 'structured from data')
    assertEqual(textReads, 0, 'did not read context body')
    assertEqual(parsed.bodyConsumed, false, 'body not consumed')
  })

  await run('13. already_linked is informational success', () => {
    const kind = classifyInviteWorkerSuccess({
      code: 'already_linked',
      inviteSent: true,
      emailDeliveryFailed: false,
    })
    assertEqual(kind, 'already_linked', 'kind')
    assertTrue(
      formatInviteWorkerSuccessToast(kind, null)
        .toLowerCase()
        .includes('already linked'),
      'info toast',
    )
  })

  console.log(`\nAll ${passed} worker invitation UI checks passed.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
