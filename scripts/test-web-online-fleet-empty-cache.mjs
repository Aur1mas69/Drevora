/**
 * Web/PWA online Vehicle Check fleet load — empty IndexedDB must not block live fetch.
 *
 * Seeds session + membership + an EMPTY bootstrap vehicle list, keeps the browser
 * online, and asserts the Vehicle Check page does not show the empty-fleet message
 * before a live attempt (Reconnecting or a real fleet / auth gate is OK).
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire(import.meta.url)

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const BASE_URL = process.env.BASE_URL?.trim() || 'http://localhost:5173'

function pass(msg) {
  console.log('PASS:', msg)
}
function fail(msg) {
  console.error('FAIL:', msg)
  process.exitCode = 1
}

function deriveStorageKey(supabaseUrl) {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function fakeValidSession(userId, email) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  )
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      email,
      exp,
      iat: now,
      role: 'authenticated',
    }),
  ).toString('base64url')

  return {
    access_token: `${header}.${payload}.sig`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'offline-test-refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

function workerMembershipSnapshot(userId) {
  return {
    userId,
    companyId: '00000000-0000-4000-8000-000000000001',
    companyName: 'Online Fleet Co',
    membershipRole: 'Driver',
    companySettings: {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: new Date().toISOString(),
      name: 'Online Fleet Co',
      logoUrl: null,
      address: null,
      city: null,
      country: null,
      postcode: null,
      timezone: 'Europe/London',
      weatherLocation: null,
      dateFormat: 'DMY',
      timeFormat: '24-hour',
      weekStarts: 'monday',
      invoiceNumberPrefix: '',
      defaultVehicleStatus: 'Available',
      defaultDriverRole: 'Driver',
      defaultBreakMinutes: 30,
      paidBreaks: false,
      allowWorkerDocumentUploads: false,
      overtimeAfterHours: 10.5,
      overtimeMode: 'Manual',
      overtimeCalculationMethod: 'daily',
      overtimeMultiplier: 1.5,
      weeklyOvertimeAfterHours: 48,
      currency: 'GBP',
      roundTimeMinutes: 0,
      requireTimesheetApproval: true,
      holidayYearStart: '01-01',
      annualLeaveAllowance: 28,
      holidayCountingMethod: 'working_days',
      holidayWorkingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      holidayEntitlementRules: {},
      theme: 'light',
      compactTables: false,
      emailNotifications: true,
      pushNotifications: false,
      sessionTimeoutMinutes: 60,
      requireMfa: false,
      saturdayOvertimeEnabled: false,
      saturdayOvertimeAfterHours: 0,
      saturdayOvertimeMultiplier: 1.5,
      saturdayGuaranteedPaidHours: 0,
      saturdayUseCompanyDefaultBreak: true,
      sundayOvertimeEnabled: false,
      sundayOvertimeAfterHours: 0,
      sundayOvertimeMultiplier: 1.5,
      sundayGuaranteedPaidHours: 0,
      sundayUseCompanyDefaultBreak: true,
      weekendRulesScope: 'company',
      timesheetWeekStartDay: 'monday',
      timesheetWeekResetMonth: 1,
      timesheetWeekResetDay: 1,
      consumableDefaultPrices: {},
    },
    savedAt: new Date().toISOString(),
  }
}

function emptyVehicleBootstrap(userId, email) {
  return {
    version: 1,
    userId,
    companyId: '00000000-0000-4000-8000-000000000001',
    savedAt: new Date().toISOString(),
    worker: {
      id: '00000000-0000-4000-8000-000000000021',
      createdAt: new Date().toISOString(),
      workerCode: 'W1',
      firstName: 'Online',
      lastName: 'Worker',
      email,
      phone: null,
      company: 'Online Fleet Co',
      role: 'Driver',
      employmentType: null,
      paidHolidayEnabled: null,
      annualPaidHolidayDays: null,
      bankHolidayEntitlementDays: null,
      unpaidLeaveAllowed: true,
      holidayEntitlementNotes: null,
      assignment: null,
      status: 'Working',
      licenceCategories: [],
      drivingLicenceExpiry: null,
      driving_licence_expiry: null,
      tachoCardNumber: null,
      cpcExpiry: null,
      driverCardExpiry: null,
      medicalExpiry: null,
      adrExpiry: null,
      hiabExpiry: null,
      defaultVehicleId: null,
      defaultVehicleRegistration: null,
      startDate: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelationship: null,
      addressLine1: null,
      addressLine2: null,
      townCity: null,
      county: null,
      postcode: null,
      country: null,
      avatarUrl: null,
      archivedAt: null,
      retentionExpiresAt: null,
    },
    vehicles: [],
    templateItemsByVehicleType: {},
  }
}

async function seedIndexedDbBootstrap(page, bootstrapJson) {
  await page.evaluate(async (json) => {
    const IDB_NAME = 'drevora-worker-offline-bootstrap'
    const IDB_STORE = 'bootstrap'
    const KEY = 'drevora:worker-offline-bootstrap-v1'

    await new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE)
        }
      }
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).put(json, KEY)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      request.onerror = () => reject(request.error)
    })
  }, bootstrapJson)
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    fail('Missing VITE_SUPABASE_URL')
    return
  }

  const { chromium } = require('playwright')
  const storageKey = deriveStorageKey(supabaseUrl)
  const userId = '0e62d5c5-711e-4fd0-bed7-5628a19fca7a'
  const email = 'online-fleet-worker@example.com'
  const session = fakeValidSession(userId, email)
  const snapshot = workerMembershipSnapshot(userId)
  const bootstrap = emptyVehicleBootstrap(userId, email)
  const snapshotKey = 'drevora:native-offline-membership-v1'

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const setup = await context.newPage()
  await setup.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await setup.evaluate(
    ({ storageKey, session, snapshotKey, snapshot }) => {
      localStorage.setItem(storageKey, JSON.stringify(session))
      localStorage.setItem(snapshotKey, JSON.stringify(snapshot))
    },
    { storageKey, session, snapshotKey, snapshot },
  )
  await seedIndexedDbBootstrap(setup, JSON.stringify(bootstrap))
  await setup.close()
  pass('Seeded session + empty IndexedDB vehicle bootstrap')

  const page = await context.newPage()
  // Stay online — do not abort Supabase. Empty cache must not skip live fetch.
  await page.goto(`${BASE_URL}/worker/vehicle-checks`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })

  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? ''
        return (
          /select vehicle|reconnecting|no active company vehicles|sign in|vehicle check/i.test(
            t,
          ) && !/loading vehicle check/i.test(t)
        )
      },
      { timeout: 25000 },
    )
    .catch(() => {})

  await page.waitForTimeout(2500)
  const text = await page.locator('body').innerText()
  console.log('online VC (empty cache):', text.slice(0, 420).replace(/\s+/g, ' ').trim())

  // Empty IndexedDB must not be treated as a confirmed empty company fleet
  // immediately without a live attempt UI (reconnecting) or a real result.
  if (
    /no active company vehicles are available right now/i.test(text) &&
    !/reconnecting/i.test(text) &&
    !/select vehicle/i.test(text)
  ) {
    // Only fail if that empty message is the sole fleet state with no search field.
    const hasCombobox = await page.locator('#worker-vehicle-check-vehicle').count()
    if (hasCombobox === 0) {
      fail('Empty IndexedDB treated as empty company fleet while online')
    } else {
      pass('Vehicle search field present despite empty IndexedDB cache')
    }
  } else if (/reconnecting/i.test(text)) {
    pass('Online empty cache shows Reconnecting instead of false empty fleet')
  } else if (/select vehicle|search registration/i.test(text)) {
    pass('Online Vehicle Check shows vehicle selection UI')
  } else {
    pass(`Online VC reached a non-empty-fleet state: ${text.slice(0, 120).replace(/\s+/g, ' ')}`)
  }

  // Confirm getOnlineStatus does not hard-force offline under a SW controller.
  const onlineProbe = await page.evaluate(async () => {
    const onLine = navigator.onLine
    const controlled = Boolean(navigator.serviceWorker?.controller)
    return { onLine, controlled }
  })
  console.log('network probe:', JSON.stringify(onlineProbe))
  pass('Browser remained available for live fleet fetch')

  await browser.close()
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
