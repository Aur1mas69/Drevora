/**
 * Web/PWA offline cold-start restoration test (no secrets printed).
 *
 * Seeds a valid Supabase session + Worker membership snapshot in localStorage,
 * then reloads with remote APIs aborted — matching close-tab → offline → reopen.
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
function warn(msg) {
  console.log('WARN:', msg)
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
      timesheetWeekStartDay: 'monday',
      timesheetWeekResetMonth: 1,
      timesheetWeekResetDay: 1,
      consumableDefaultPrices: {},
    },
    savedAt: new Date().toISOString(),
  }
}

function classifyUi(bodyText) {
  const onLogin =
    (/sign in/i.test(bodyText) && /password/i.test(bodyText)) ||
    /manage your fleet, team/i.test(bodyText) ||
    /account login/i.test(bodyText)
  const onWorkerHome =
    /start vehicle check/i.test(bodyText) ||
    /offline test co/i.test(bodyText) ||
    (/good (morning|afternoon|evening)/i.test(bodyText) &&
      /quick actions|home/i.test(bodyText))
  const offlineBanner = /you.?re offline|you are offline|live .* unavailable/i.test(
    bodyText,
  )
  return { onLogin, onWorkerHome, offlineBanner }
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  if (!supabaseUrl) {
    fail('Missing VITE_SUPABASE_URL')
    return
  }

  const recoverSrc = fs.readFileSync('src/lib/nativeAuthSessionRecover.ts', 'utf8')
  const membershipSrc = fs.readFileSync('src/lib/nativeOfflineMembership.ts', 'utf8')
  console.log('web recover uses localStorage:', recoverSrc.includes('localStorage'))
  console.log(
    'web membership uses localStorage:',
    membershipSrc.includes('localStorage'),
  )

  const storageKey = deriveStorageKey(supabaseUrl)
  const userId = '0e62d5c5-711e-4fd0-bed7-5628a19fca7a'
  const email = 'offline-worker@example.com'
  const session = fakeValidSession(userId, email)
  const snapshot = workerMembershipSnapshot(userId)
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
  await setup.close()
  pass('Seeded browser session + Worker membership snapshot')

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
          ( /start vehicle check/i.test(t) ||
            /manage your fleet/i.test(t) ||
            /sign in/i.test(t) ||
            /offline test co/i.test(t) ||
            /good (morning|afternoon|evening)/i.test(t))
        )
      },
      { timeout: 20000 },
    )
    .catch(() => {})

  await page.waitForTimeout(1500)
  const bodyText = await page.locator('body').innerText()
  console.log('offline UI:', bodyText.slice(0, 320).replace(/\s+/g, ' ').trim())

  const offline = classifyUi(bodyText)
  if (offline.onWorkerHome && !offline.onLogin) {
    pass('Worker Home opened offline (not Login)')
    if (offline.offlineBanner) pass('Offline banner visible')
    else warn('Offline banner not detected')
  } else if (offline.onLogin) {
    fail('Offline cold start showed Login instead of Worker Home')
  } else {
    fail(
      `Unexpected offline UI. Body starts: ${bodyText.slice(0, 180).replace(/\s+/g, ' ')}`,
    )
  }

  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
    window.dispatchEvent(new Event('online'))
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  const onlineText = await page.locator('body').innerText()
  const online = classifyUi(onlineText)
  if (!online.onLogin) {
    pass('After reconnect, Login was not forced')
  } else {
    fail('After reconnect, still on Login')
  }

  await browser.close()
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
