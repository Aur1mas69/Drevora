/**
 * Web/PWA offline Worker bootstrap cache cold-start test (no secrets printed).
 *
 * Seeds session + membership + IndexedDB bootstrap (worker, vehicles, templates),
 * then reloads with remote APIs aborted — matching online warm → offline reopen.
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

function loadPlaywright() {
  return require('playwright')
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
    companyName: 'Offline Test Co',
    membershipRole: 'Driver',
    companySettings: {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: new Date().toISOString(),
      name: 'Offline Test Co',
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
      timesheetManagementScope: 'worker',
      timesheetWeekStartDay: 'monday',
      timesheetWeekResetMonth: 1,
      timesheetWeekResetDay: 1,
      consumableDefaultPrices: {},
    },
    savedAt: new Date().toISOString(),
  }
}

function workerBootstrapCache(userId, email) {
  const companyId = '00000000-0000-4000-8000-000000000001'
  const vehicleId = '00000000-0000-4000-8000-000000000011'
  return {
    version: 1,
    userId,
    companyId,
    savedAt: new Date().toISOString(),
    worker: {
      id: '00000000-0000-4000-8000-000000000021',
      createdAt: new Date().toISOString(),
      workerCode: 'W1',
      firstName: 'Offline',
      lastName: 'Worker',
      email,
      phone: null,
      company: 'Offline Test Co',
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
      defaultVehicleId: vehicleId,
      defaultVehicleRegistration: 'AB12 CDE',
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
    vehicles: [
      {
        id: vehicleId,
        createdAt: new Date().toISOString(),
        registration: 'AB12 CDE',
        fleetNumber: null,
        trailerNumber: null,
        make: 'Volvo',
        model: 'FH',
        year: 2020,
        vin: null,
        currentOdometer: 100000,
        vehicleType: 'HGV',
        baseStatus: 'Available',
        status: 'Available',
        availabilityStatus: 'Available',
        currentDriverId: null,
        insuranceExpiry: null,
        motExpiry: null,
        roadTaxExpiry: null,
        tachographExpiry: null,
        offRoadReason: null,
        offRoadStartDate: null,
        offRoadExpectedReturnDate: null,
        offRoadStart: null,
        offRoadReturn: null,
        offRoadNotes: null,
        notes: null,
        availabilityRecords: [],
        archivedAt: null,
        archiveReason: null,
        retentionExpiresAt: null,
      },
    ],
    templateItemsByVehicleType: {
      HGV: [
        {
          id: 'tmpl-1',
          templateId: 'tmpl',
          section: 'Exterior',
          label: 'Front view',
          description: 'Check front of vehicle',
          sortOrder: 1,
          isRequired: true,
          allowNotes: true,
          allowPhoto: true,
          failOnDefect: true,
          isActive: true,
          isCustom: false,
          createdAt: new Date().toISOString(),
        },
      ],
    },
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

  const storageSrc = fs.readFileSync(
    'src/lib/workerOfflineBootstrap/storage.ts',
    'utf8',
  )
  const nativeSrc = fs.readFileSync(
    'src/lib/workerOfflineBootstrap/storage.native.ts',
    'utf8',
  )
  if (!storageSrc.includes('indexedDB')) {
    fail('Web bootstrap storage must use IndexedDB')
    return
  }
  if (!nativeSrc.includes('Preferences')) {
    fail('Native bootstrap storage must use Preferences')
    return
  }
  pass('Platform storage adapters present (IndexedDB / Preferences)')

  const storageKey = deriveStorageKey(supabaseUrl)
  const userId = '0e62d5c5-711e-4fd0-bed7-5628a19fca7a'
  const email = 'offline-worker@example.com'
  const session = fakeValidSession(userId, email)
  const snapshot = workerMembershipSnapshot(userId)
  const bootstrap = workerBootstrapCache(userId, email)
  const snapshotKey = 'drevora:native-offline-membership-v1'

  const { chromium } = loadPlaywright()
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
  pass('Seeded session, membership, and IndexedDB bootstrap cache')

  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
  })
  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (
      url.startsWith(BASE_URL) ||
      url.includes('localhost:5173') ||
      url.includes('127.0.0.1:5173')
    ) {
      return route.continue()
    }
    return route.abort('failed')
  })

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? ''
        return (
          !/loading your workspace/i.test(t) &&
          (/start vehicle check/i.test(t) || /sign in/i.test(t))
        )
      },
      { timeout: 25000 },
    )
    .catch(() => {})

  await page.waitForTimeout(1500)
  const homeText = await page.locator('body').innerText()
  console.log('offline Home:', homeText.slice(0, 360).replace(/\s+/g, ' ').trim())

  if (!/start vehicle check/i.test(homeText)) {
    fail('Start Vehicle Check CTA missing on offline Home')
  } else {
    pass('Start Vehicle Check CTA visible offline')
  }

  if (/Offline Test Co/i.test(homeText)) {
    pass('Worker greeting kept on offline Home')
  } else {
    fail('Worker greeting missing on offline Home')
  }

  // Offline Home renders the CTA only — no live dashboard cards, no Quick actions.
  if (/quick actions/i.test(homeText)) {
    fail('Quick actions still rendered on offline Home')
  } else {
    pass('Quick actions hidden offline')
  }

  if (/default vehicle/i.test(homeText)) {
    fail('Default vehicle card still rendered on offline Home')
  } else {
    pass('Live dashboard cards hidden offline')
  }

  if (/connect to the internet once to prepare/i.test(homeText)) {
    fail('Not-prepared message shown despite seeded bootstrap cache')
  } else {
    pass('Not-prepared message correctly absent when cache exists')
  }

  await page.goto(`${BASE_URL}/worker/vehicle-checks`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? ''
        return (
          !/loading your workspace/i.test(t) &&
          (/vehicle check/i.test(t) || /AB12 CDE/i.test(t) || /sign in/i.test(t))
        )
      },
      { timeout: 25000 },
    )
    .catch(() => {})
  await page.waitForTimeout(1000)
  const vcText = await page.locator('body').innerText()
  console.log('offline VC:', vcText.slice(0, 360).replace(/\s+/g, ' ').trim())

  if (/unable to start a vehicle check/i.test(vcText) && !/AB12 CDE/i.test(vcText)) {
    fail('Vehicle Check gated offline despite bootstrap cache')
  } else if (
    /AB12 CDE/i.test(vcText) ||
    /select vehicle/i.test(vcText) ||
    (/vehicle check/i.test(vcText) && !/loading your workspace/i.test(vcText))
  ) {
    pass('Vehicle Check flow opened offline with cached fleet')
  } else {
    fail(`Unexpected Vehicle Check UI: ${vcText.slice(0, 180).replace(/\s+/g, ' ')}`)
  }

  if (!/AB12 CDE/i.test(vcText)) {
    fail('Cached vehicle registration not visible on offline Vehicle Check setup')
  } else {
    pass('Cached vehicle visible on Vehicle Check setup')
  }

  // Open checklist from cached vehicle (default should be pre-selected).
  const continueBtn = page.getByRole('button', { name: /^Continue$/ })
  await continueBtn.waitFor({ state: 'visible', timeout: 10000 })
  await continueBtn.click()
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? ''
        return (
          /front view/i.test(t) ||
          /mark each item/i.test(t) ||
          /checklist for/i.test(t) ||
          /failed to load inspection checklist/i.test(t)
        )
      },
      { timeout: 15000 },
    )
    .catch(() => {})
  await page.waitForTimeout(500)
  const checklistText = await page.locator('body').innerText()
  console.log(
    'offline checklist:',
    checklistText.slice(0, 360).replace(/\s+/g, ' ').trim(),
  )
  if (/failed to load inspection checklist/i.test(checklistText)) {
    fail('Checklist load failed offline')
  } else if (
    /front view/i.test(checklistText) ||
    /checklist for AB12 CDE/i.test(checklistText) ||
    /mark each item as OK, Defect, or N\/A/i.test(checklistText)
  ) {
    pass('Vehicle Check checklist opened offline from bootstrap cache')
  } else {
    fail('Checklist did not open offline from cached templates/DVSA merge')
  }

  // Offline Home without a prepared cache: CTA stays, prepare message appears.
  const bare = await browser.newContext()
  const barePage = await bare.newPage()
  await barePage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await barePage.evaluate(
    ({ storageKey, session, snapshotKey, snapshot }) => {
      localStorage.setItem(storageKey, JSON.stringify(session))
      localStorage.setItem(snapshotKey, JSON.stringify(snapshot))
    },
    { storageKey, session, snapshotKey, snapshot },
  )
  await barePage.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
  })
  await barePage.route('**/*', async (route) => {
    const url = route.request().url()
    if (
      url.startsWith(BASE_URL) ||
      url.includes('localhost:5173') ||
      url.includes('127.0.0.1:5173')
    ) {
      return route.continue()
    }
    return route.abort('failed')
  })
  await barePage.goto(`${BASE_URL}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await barePage
    .waitForFunction(
      () => /connect to the internet once to prepare/i.test(document.body?.innerText ?? ''),
      { timeout: 20000 },
    )
    .catch(() => {})
  const bareText = await barePage.locator('body').innerText()
  console.log(
    'offline Home (no cache):',
    bareText.slice(0, 240).replace(/\s+/g, ' ').trim(),
  )
  if (/connect to the internet once to prepare/i.test(bareText)) {
    pass('Prepare message shown offline when cache is missing')
  } else {
    fail('Prepare message missing offline without cache')
  }
  if (/start vehicle check/i.test(bareText)) {
    pass('Start Vehicle Check CTA still visible offline without cache')
  } else {
    fail('Start Vehicle Check CTA hidden offline without cache')
  }
  await bare.close()

  await browser.close()
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
