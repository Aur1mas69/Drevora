/**
 * Focused verification: DVLA VES Add Vehicle lookup (mode, mapping, auth boundary).
 * Run: npm run verify:dvla-vehicle-enquiry
 *
 * Does not call DVLA or Supabase — pure helpers + static Edge/UI source checks.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DVLA_UAT_TEST_REGISTRATIONS,
  DVLA_VES_API_KEY_ENV,
  DVLA_VES_MODE_ENV,
  DVLA_VES_PRODUCTION_ENDPOINT,
  DVLA_VES_UAT_API_KEY_ENV,
  DVLA_VES_UAT_ENDPOINT,
  VITE_DVLA_LOOKUP_ENABLED_ENV,
  buildVehicleFormPatchFromDvla,
  formatDvlaEnquiryUserMessage,
  isDvlaLookupUiEnabled,
  isPlausibleRegistrationNumber,
  mapDvlaHttpStatusToCode,
  mapDvlaResponseToVehicle,
  normalizeRegistrationNumber,
  parseDvlaIsoDate,
  resolveDvlaVesUpstream,
} from '../src/lib/dvlaVehicleEnquiry.ts'

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
  return readFileSync(resolve(relative), 'utf8').replace(/\r\n/g, '\n')
}

const edge = read('supabase/functions/dvla-vehicle-enquiry/index.ts')
const shared = read('supabase/functions/_shared/dvlaVes.ts')
const aal2 = read('supabase/functions/_shared/requireAal2.ts')
const modal = read('src/components/vehicles/VehicleEditModal.tsx')
const service = read('src/services/dvlaVehicleEnquiryService.ts')
const lib = read('src/lib/dvlaVehicleEnquiry.ts')

run('1. VRN normalization trims spaces and uppercases', () => {
  assertEqual(normalizeRegistrationNumber(' aa19 aaa '), 'AA19AAA', 'normalize')
  assertEqual(normalizeRegistrationNumber('er19bad'), 'ER19BAD', 'normalize lower')
})

run('2. Blank / invalid registration rejected locally', () => {
  assertTrue(!isPlausibleRegistrationNumber(''), 'blank')
  assertTrue(!isPlausibleRegistrationNumber('A'), 'too short')
  assertTrue(!isPlausibleRegistrationNumber('AA19AAA!'), 'punctuation')
  assertTrue(isPlausibleRegistrationNumber('AA19AAA'), 'valid')
  assertTrue(isPlausibleRegistrationNumber('AA19PPP'), 'uat hgv style')
})

run('3. UAT / production / disabled mode selection', () => {
  const disabled = resolveDvlaVesUpstream({
    mode: 'disabled',
    uatApiKey: 'uat-secret',
    productionApiKey: 'prod-secret',
  })
  assertTrue(!disabled.ok && disabled.code === 'DVLA_DISABLED', 'disabled')

  const missingMode = resolveDvlaVesUpstream({
    mode: '',
    uatApiKey: 'uat-secret',
    productionApiKey: 'prod-secret',
  })
  assertTrue(!missingMode.ok && missingMode.code === 'DVLA_DISABLED', 'missing mode fail-closed')

  const uat = resolveDvlaVesUpstream({
    mode: 'uat',
    uatApiKey: 'uat-secret',
    productionApiKey: 'prod-secret',
  })
  assertTrue(uat.ok, 'uat ok')
  if (uat.ok) {
    assertEqual(uat.endpoint, DVLA_VES_UAT_ENDPOINT, 'uat endpoint')
    assertEqual(uat.apiKeyEnvName, DVLA_VES_UAT_API_KEY_ENV, 'uat key env')
    assertEqual(uat.apiKey, 'uat-secret', 'uat key value selected')
  }

  const production = resolveDvlaVesUpstream({
    mode: 'production',
    uatApiKey: 'uat-secret',
    productionApiKey: 'prod-secret',
  })
  assertTrue(production.ok, 'production ok')
  if (production.ok) {
    assertEqual(production.endpoint, DVLA_VES_PRODUCTION_ENDPOINT, 'prod endpoint')
    assertEqual(production.apiKeyEnvName, DVLA_VES_API_KEY_ENV, 'prod key env')
    assertEqual(production.apiKey, 'prod-secret', 'prod key value selected')
  }

  const uatMissingKey = resolveDvlaVesUpstream({
    mode: 'uat',
    uatApiKey: '',
    productionApiKey: 'prod-secret',
  })
  assertTrue(
    !uatMissingKey.ok && uatMissingKey.code === 'DVLA_NOT_CONFIGURED',
    'uat missing key',
  )
})

run('4. Disabled mode performs no upstream request (Edge fail-closed before fetch)', () => {
  const resolveIdx = edge.indexOf('resolveDvlaVesUpstream(')
  const fetchIdx = edge.indexOf('await fetch(upstream.endpoint')
  const blockIdx = edge.indexOf('if (!upstream.ok)')
  assertTrue(resolveIdx > 0, 'resolve present')
  assertTrue(blockIdx > resolveIdx, 'block after resolve')
  assertTrue(fetchIdx > blockIdx, 'fetch only after mode allowed')
  assertTrue(edge.includes("code: upstream.code"), 'returns DVLA_DISABLED path')
})

run('5. Correct secret env names and endpoints in Edge shared helper', () => {
  assertTrue(shared.includes(DVLA_VES_UAT_ENDPOINT), 'uat endpoint constant')
  assertTrue(shared.includes(DVLA_VES_PRODUCTION_ENDPOINT), 'prod endpoint constant')
  assertTrue(shared.includes(DVLA_VES_MODE_ENV), 'mode env')
  assertTrue(shared.includes(DVLA_VES_UAT_API_KEY_ENV), 'uat key env')
  assertTrue(shared.includes(DVLA_VES_API_KEY_ENV), 'prod key env')
  assertTrue(
    edge.includes(`trimEnv(${DVLA_VES_MODE_ENV}`) ||
      edge.includes(`trimEnv(DVLA_VES_MODE_ENV)`),
    'edge reads mode from env helper',
  )
  assertTrue(edge.includes('DVLA_VES_UAT_API_KEY_ENV'), 'edge uat key env')
  assertTrue(edge.includes('DVLA_VES_API_KEY_ENV'), 'edge prod key env')
})

run('6. No secret / mode selection from browser body', () => {
  assertTrue(service.includes("functions.invoke("), 'invoke used')
  assertTrue(service.includes("'dvla-vehicle-enquiry'"), 'invoke name')
  assertTrue(service.includes('const body = { registrationNumber }'), 'body only registration')
  assertTrue(!service.includes('DVLA_VES_'), 'service has no DVLA secrets')
  assertTrue(!service.includes('x-api-key'), 'service has no x-api-key')
  assertTrue(!lib.includes('x-api-key'), 'lib has no x-api-key')
  assertTrue(edge.includes('Body mode/endpoint/key are ignored'), 'ignore body mode comment')
  assertTrue(edge.includes("'x-api-key': upstream.apiKey"), 'x-api-key only on server fetch')
})

run('7. Office role + AAL2 required; Driver blocked', () => {
  assertTrue(edge.includes('import { requireCallerAal2 }'), 'imports AAL2 helper')
  assertTrue(aal2.includes('export async function requireCallerAal2'), 'shared helper exists')
  const officeIdx = edge.indexOf('OFFICE_ROLES.has(membership.role)')
  const aalIdx = edge.indexOf('requireCallerAal2(userClient, token)')
  assertTrue(officeIdx > 0, 'office role check')
  assertTrue(aalIdx > officeIdx, 'AAL2 after office role')
  const rolesBlockStart = edge.indexOf('const OFFICE_ROLES = new Set([')
  const rolesBlockEnd = edge.indexOf('])', rolesBlockStart)
  assertTrue(rolesBlockStart > 0 && rolesBlockEnd > rolesBlockStart, 'office roles block')
  const rolesBlock = edge.slice(rolesBlockStart, rolesBlockEnd)
  assertTrue(!rolesBlock.includes("'Driver'"), 'Driver not in office allowlist')
  assertTrue(rolesBlock.includes("'Admin'"), 'Admin allowed')
  assertTrue(rolesBlock.includes("'Supervisor'"), 'Supervisor allowed')
})

run('8. Successful field mapping autofills only allowed form fields', () => {
  const vehicle = mapDvlaResponseToVehicle(
    {
      registrationNumber: 'AA19 PPP',
      make: 'DAF',
      yearOfManufacture: 2019,
      motExpiryDate: '2026-01-15',
      taxDueDate: '2026-03-01',
      motStatus: 'Valid',
      taxStatus: 'Taxed',
      colour: 'WHITE',
      fuelType: 'DIESEL',
      revenueWeight: 18000,
      wheelplan: '2 AXLE RIGID BODY',
      typeApproval: 'N3',
      euroStatus: 'EURO 6',
      engineCapacity: 10837,
      model: 'XF',
      vin: 'SHOULD-NOT-MAP',
    },
    'AA19PPP',
  )
  assertTrue(vehicle != null, 'mapped')
  if (!vehicle) return
  assertEqual(vehicle.registrationNumber, 'AA19PPP', 'registration normalized')
  assertEqual(vehicle.make, 'DAF', 'make')
  const patch = buildVehicleFormPatchFromDvla(vehicle)
  assertEqual(patch.registration, 'AA19PPP', 'patch registration')
  assertEqual(patch.make, 'DAF', 'patch make')
  assertEqual(patch.year, '2019', 'patch year')
  assertEqual(patch.motExpiry, '2026-01-15', 'patch mot')
  assertEqual(patch.roadTaxExpiry, '2026-03-01', 'patch tax')
  assertTrue(!('model' in patch), 'model not in patch')
  assertTrue(!('vin' in patch), 'vin not in patch')
  assertTrue(!('vehicleType' in patch), 'vehicleType not in patch')
  assertTrue(!('currentDriverId' in patch), 'driver not in patch')
  assertTrue(!('insuranceExpiry' in patch), 'insurance not in patch')
  assertTrue(!('tachographExpiry' in patch), 'tacho not in patch')
})

run('9. Placeholder dates rejected for HTML date inputs', () => {
  assertEqual(parseDvlaIsoDate('<1 YEAR FROM NOW>'), null, 'placeholder')
  assertEqual(parseDvlaIsoDate('not-a-date'), null, 'junk')
  assertEqual(parseDvlaIsoDate('2026-13-40'), null, 'invalid calendar')
  assertEqual(parseDvlaIsoDate('2026-01-15'), '2026-01-15', 'valid')

  const vehicle = mapDvlaResponseToVehicle(
    {
      registrationNumber: 'AA19AAA',
      make: 'FORD',
      motExpiryDate: '<1 YEAR FROM NOW>',
      taxDueDate: 'soon',
    },
    'AA19AAA',
  )
  assertTrue(vehicle != null, 'vehicle')
  if (!vehicle) return
  assertEqual(vehicle.motExpiryDate, null, 'mot placeholder dropped')
  assertEqual(vehicle.taxDueDate, null, 'tax placeholder dropped')
  const patch = buildVehicleFormPatchFromDvla(vehicle)
  assertTrue(patch.motExpiry === undefined, 'mot not patched')
  assertTrue(patch.roadTaxExpiry === undefined, 'tax not patched')
})

run('10. Error mapping + human messages', () => {
  assertEqual(mapDvlaHttpStatusToCode(400), 'DVLA_INVALID_REGISTRATION', '400')
  assertEqual(mapDvlaHttpStatusToCode(404), 'DVLA_VEHICLE_NOT_FOUND', '404')
  assertEqual(mapDvlaHttpStatusToCode(429), 'DVLA_RATE_LIMITED', '429')
  assertEqual(mapDvlaHttpStatusToCode(500), 'DVLA_SERVICE_ERROR', '500')
  assertEqual(mapDvlaHttpStatusToCode(503), 'DVLA_SERVICE_UNAVAILABLE', '503')
  assertEqual(
    formatDvlaEnquiryUserMessage('DVLA_INVALID_REGISTRATION'),
    'Check the registration number and try again.',
    '400 message',
  )
  assertEqual(
    formatDvlaEnquiryUserMessage('DVLA_VEHICLE_NOT_FOUND'),
    'Vehicle not found in DVLA records.',
    '404 message',
  )
  assertEqual(
    formatDvlaEnquiryUserMessage('DVLA_RATE_LIMITED'),
    'DVLA request limit reached. Please try again shortly.',
    '429 message',
  )
  assertEqual(
    formatDvlaEnquiryUserMessage('DVLA_DISABLED'),
    'DVLA lookup is not currently available.',
    'disabled message',
  )
  assertEqual(
    formatDvlaEnquiryUserMessage('DVLA_NOT_CONFIGURED'),
    'DVLA lookup is not configured.',
    'not configured message',
  )
})

run('11. UAT test registration catalogue present', () => {
  assertTrue('AA19PPP' in DVLA_UAT_TEST_REGISTRATIONS, 'AA19PPP')
  assertTrue('AA19AAA' in DVLA_UAT_TEST_REGISTRATIONS, 'AA19AAA')
  assertEqual(DVLA_UAT_TEST_REGISTRATIONS.ER19BAD.httpStatus, 400, 'ER19BAD')
  assertEqual(DVLA_UAT_TEST_REGISTRATIONS.ER19NFD.httpStatus, 404, 'ER19NFD')
  assertEqual(DVLA_UAT_TEST_REGISTRATIONS.ER19THR.httpStatus, 429, 'ER19THR')
  assertEqual(DVLA_UAT_TEST_REGISTRATIONS.ER19ERR.httpStatus, 500, 'ER19ERR')
  assertEqual(DVLA_UAT_TEST_REGISTRATIONS.ER19MNT.httpStatus, 503, 'ER19MNT')
})

run('12. UI flag disabled shows DVLA Soon; enabled shows Check DVLA', () => {
  assertTrue(!isDvlaLookupUiEnabled(undefined), 'missing false')
  assertTrue(!isDvlaLookupUiEnabled('false'), 'false')
  assertTrue(isDvlaLookupUiEnabled('true'), 'true')
  assertTrue(modal.includes('VITE_DVLA_LOOKUP_ENABLED'), 'reads vite flag')
  assertTrue(modal.includes('Check DVLA'), 'active label')
  assertTrue(modal.includes('DVLA Soon'), 'disabled label retained')
  assertTrue(modal.includes('DVLA Vehicle Data'), 'info panel')
  assertTrue(modal.includes(VITE_DVLA_LOOKUP_ENABLED_ENV) || modal.includes('VITE_DVLA_LOOKUP_ENABLED'), 'flag name')
  assertTrue(modal.includes('Failed lookup must not overwrite'), 'no overwrite comment')
})

run('13. Edge never logs API key material', () => {
  assertTrue(!edge.includes('console.log(upstream.apiKey)'), 'no key log')
  assertTrue(!edge.includes('JSON.stringify(upstream.apiKey)'), 'no key stringify')
  const logBlocks = [...edge.matchAll(/logSafe\(\{([\s\S]*?)\}\)/g)].map((m) => m[1])
  assertTrue(logBlocks.length > 0, 'has logSafe calls')
  for (const block of logBlocks) {
    assertTrue(!/\bapiKey\s*:/.test(block), 'logSafe does not include apiKey value')
  }
  assertTrue(edge.includes('apiKeyEnvName'), 'logs env name only')
  assertTrue(edge.includes('Do not log keys'), 'safe logging comment')
})

console.log(`\nAll ${passed} checks passed.`)
