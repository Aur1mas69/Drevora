/**
 * Focused verification: Office MFA Pause/Resume Edge authorization helper.
 * Run: npm run verify:office-mfa-edge-aal2
 *
 * Executes the pure Edge policy matrix. Does not call Supabase or deploy.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  isOfficeMfaEnabledRpcMissing,
  resolveOfficeMfaEdgeAuthorization,
  resolveOfficeMfaEnabledLookup,
  type RequireAal2Result,
} from '../supabase/functions/_shared/officeMfaEdgePolicy.ts'

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

function isDenied(result: RequireAal2Result): boolean {
  return result.ok === false && result.code === 'MFA_REQUIRED' && result.httpStatus === 403
}

const shared = read('supabase/functions/_shared/requireAal2.ts')
const policy = read('supabase/functions/_shared/officeMfaEdgePolicy.ts')

run('1. migration absent + verified factor => old AAL2 behaviour', () => {
  const aal1 = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'rpc_missing' },
    hasVerifiedFactor: true,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  const aal2 = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'rpc_missing' },
    hasVerifiedFactor: true,
    effectiveAal: 'aal2',
    jwtAal: 'aal2',
  })
  assertTrue(isDenied(aal1), 'AAL1 + factor still MFA_REQUIRED before migration')
  assertTrue(aal2.ok, 'AAL2 + factor allowed before migration')
})

run('2. migration absent + no factor => AAL1 allowed', () => {
  const result = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'rpc_missing' },
    hasVerifiedFactor: false,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  assertTrue(result.ok, 'AAL1 allowed when no verified factor before migration')
})

run('3. mfa_enabled=false + verified factor + AAL1 => allowed', () => {
  const result = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: false },
    hasVerifiedFactor: true,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  assertTrue(result.ok, 'Paused MFA allows AAL1 with saved authenticator')
})

run('4. mfa_enabled=true + verified factor + AAL1 => MFA_REQUIRED', () => {
  const result = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: true },
    hasVerifiedFactor: true,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  assertTrue(isDenied(result), 'enforced MFA rejects AAL1')
})

run('5. mfa_enabled=true + verified factor + AAL2 => allowed', () => {
  const result = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: true },
    hasVerifiedFactor: true,
    effectiveAal: 'aal2',
    jwtAal: 'aal2',
  })
  assertTrue(result.ok, 'enforced MFA allows AAL2')
})

run('6. mfa_enabled=true + no factor => MFA_REQUIRED', () => {
  const aal1 = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: true },
    hasVerifiedFactor: false,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  const aal2 = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: true },
    hasVerifiedFactor: false,
    effectiveAal: 'aal2',
    jwtAal: 'aal2',
  })
  assertTrue(isDenied(aal1), 'fail closed at AAL1 without factor')
  assertTrue(isDenied(aal2), 'fail closed even at AAL2 without factor')
})

run('7. unexpected RPC/database error => fail closed, no compatibility fallback', () => {
  const permission = resolveOfficeMfaEnabledLookup({
    error: { code: '42501', message: 'permission denied for function drevora_auth_office_mfa_is_enabled' },
    data: null,
  })
  const dbError = resolveOfficeMfaEnabledLookup({
    error: { code: '57014', message: 'canceling statement due to statement timeout' },
    data: null,
  })
  const malformed = resolveOfficeMfaEnabledLookup({
    error: null,
    data: 'yes',
  })
  const nullData = resolveOfficeMfaEnabledLookup({
    error: null,
    data: null,
  })

  assertEqual(permission.status, 'rpc_error', 'permission is not missing-RPC')
  assertEqual(dbError.status, 'rpc_error', 'timeout is not missing-RPC')
  assertEqual(malformed.status, 'rpc_error', 'non-boolean payload is not missing-RPC')
  assertEqual(nullData.status, 'rpc_error', 'null payload is not missing-RPC')

  assertTrue(
    !isOfficeMfaEnabledRpcMissing({
      code: '42501',
      message: 'permission denied for function drevora_auth_office_mfa_is_enabled',
    }),
    'permission denied does not fall back',
  )
  assertTrue(
    !isOfficeMfaEnabledRpcMissing({
      code: 'PGRST202',
      message: 'permission denied for function drevora_auth_office_mfa_is_enabled',
    }),
    'permission marker wins over PGRST202',
  )

  const denied = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'rpc_error' },
    hasVerifiedFactor: true,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  assertTrue(isDenied(denied), 'rpc_error is MFA_REQUIRED')

  const pausedWouldHaveAllowed = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'rpc_error' },
    hasVerifiedFactor: true,
    effectiveAal: 'aal1',
    jwtAal: 'aal1',
  })
  assertTrue(isDenied(pausedWouldHaveAllowed), 'no silent AAL1 fallback on unexpected error')
})

run('8. missing-RPC detector only matches function-does-not-exist', () => {
  assertTrue(
    isOfficeMfaEnabledRpcMissing({
      code: 'PGRST202',
      message:
        'Could not find the function public.drevora_auth_office_mfa_is_enabled without parameters in the schema cache',
    }),
    'PGRST202 schema cache miss',
  )
  assertTrue(
    isOfficeMfaEnabledRpcMissing({
      code: '42883',
      message: 'function public.drevora_auth_office_mfa_is_enabled() does not exist',
    }),
    'PostgreSQL undefined_function',
  )
  assertTrue(
    isOfficeMfaEnabledRpcMissing({
      message:
        'could not find the function public.drevora_auth_office_mfa_is_enabled in the schema cache',
    }),
    'message-only missing function',
  )
  assertTrue(
    !isOfficeMfaEnabledRpcMissing({
      code: 'PGRST301',
      message: 'JWT expired',
    }),
    'JWT error is not missing-RPC',
  )
  assertTrue(
    !isOfficeMfaEnabledRpcMissing({
      message: 'drevora_auth_office_mfa_is_enabled failed',
    }),
    'generic function failure is not missing-RPC',
  )
  assertTrue(!isOfficeMfaEnabledRpcMissing(null), 'null error is not missing')
})

run('9. no client / IP / user_metadata authority', () => {
  for (const [name, source] of [
    ['requireAal2', shared],
    ['officeMfaEdgePolicy', policy],
  ] as const) {
    assertTrue(!source.includes('body.aal'), `${name}: no body.aal`)
    assertTrue(!source.includes('body?.aal'), `${name}: no body?.aal`)
    assertTrue(!source.includes('body.mfa_enabled'), `${name}: no body.mfa_enabled`)
    assertTrue(!source.includes('user.user_metadata'), `${name}: no user.user_metadata`)
    assertTrue(!source.includes('localStorage.getItem'), `${name}: no localStorage`)
    assertTrue(!/\buserIp\b|\bclientIp\b|\btrustedDevice\b/.test(source), `${name}: no IP trust`)
  }

  assertTrue(shared.includes('drevora_auth_office_mfa_is_enabled'), 'calls server RPC')
  assertTrue(shared.includes("userClient.rpc('drevora_auth_office_mfa_is_enabled')"), 'user JWT RPC')
  assertTrue(!shared.includes('SUPABASE_SERVICE_ROLE'), 'does not read service role key')
  assertTrue(!shared.includes('serviceRole'), 'does not construct a service-role client')
  assertTrue(
    shared.includes('never from request body') ||
      shared.includes('Never trust an `aal`') ||
      shared.includes('never trusts request body'),
    'documents no body trust',
  )
})

run('10. requireCallerAal2 still owns I/O and keeps the public API', () => {
  assertTrue(shared.includes('export async function requireCallerAal2'), 'public helper kept')
  assertTrue(shared.includes('export function readAalClaimFromAccessToken'), 'JWT reader kept')
  assertTrue(shared.includes('getAuthenticatorAssuranceLevel'), 'assurance API')
  assertTrue(shared.includes('listFactors'), 'lists factors')
  assertTrue(shared.includes('resolveOfficeMfaEnabledLookup'), 'classifies RPC result')
  assertTrue(shared.includes('resolveOfficeMfaEdgeAuthorization'), 'applies matrix')
})

run('11. JWT claim contradiction still fails closed when MFA is enforced', () => {
  const contradicted = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: true },
    hasVerifiedFactor: true,
    effectiveAal: 'aal2',
    jwtAal: 'aal1',
  })
  assertTrue(isDenied(contradicted), 'JWT aal1 contradicts assurance aal2')

  const paused = resolveOfficeMfaEdgeAuthorization({
    lookup: { status: 'ok', mfaEnabled: false },
    hasVerifiedFactor: true,
    effectiveAal: 'aal2',
    jwtAal: 'aal1',
  })
  assertTrue(paused.ok, 'Pause does not require JWT aal2')
})

console.log(`\nAll ${passed} checks passed.`)
