/**
 * Focused verification for Regional Date Format on Admin date filters.
 * Run: npm run verify:company-date-format
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  formatDateFromIso,
  getDateFormatLabel,
  setGlobalDateFormat,
  getGlobalDateFormat,
} from '../src/lib/dateTimeFormat.ts'

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

const SAMPLE_ISO = '2026-03-15'

const adminFilterSources = [
  'src/components/vehicle-checks/TyreChecksToolbar.tsx',
  'src/components/vehicle-checks/VehicleChecksToolbar.tsx',
  'src/components/driver-reports/DriverReportsToolbar.tsx',
  'src/components/consumables/ConsumablesToolbar.tsx',
  'src/components/export/ExportDateRangeControls.tsx',
  'src/components/timesheets/TimesheetsToolbar.tsx',
  'src/components/holidays/HolidayRequestsToolbar.tsx',
].map((relative) => ({
  relative,
  source: readFileSync(resolve(relative), 'utf8'),
}))

const companyDateInputSource = readFileSync(
  resolve('src/components/common/CompanyDateInput.tsx'),
  'utf8',
)
const holidayDateInputSource = readFileSync(
  resolve('src/components/holidays/HolidayDateInput.tsx'),
  'utf8',
)
const globalsSource = readFileSync(
  resolve('src/lib/companySettingsGlobals.ts'),
  'utf8',
)

run('1. DD/MM/YYYY rendering (DMY)', () => {
  assertEqual(getDateFormatLabel('DMY'), 'DD/MM/YYYY', 'DMY label')
  assertEqual(
    formatDateFromIso(SAMPLE_ISO, { dateFormat: 'DMY' }),
    '15/03/2026',
    'DMY display',
  )
})

run('2. MM/DD/YYYY rendering (MDY)', () => {
  assertEqual(getDateFormatLabel('MDY'), 'MM/DD/YYYY', 'MDY label')
  assertEqual(
    formatDateFromIso(SAMPLE_ISO, { dateFormat: 'MDY' }),
    '03/15/2026',
    'MDY display',
  )
})

run('3. ISO internal value preservation', () => {
  const iso = SAMPLE_ISO
  const dmy = formatDateFromIso(iso, { dateFormat: 'DMY' })
  const mdy = formatDateFromIso(iso, { dateFormat: 'MDY' })
  assertEqual(iso, '2026-03-15', 'ISO unchanged after format calls')
  assertTrue(dmy !== iso && mdy !== iso, 'display differs from ISO')
  assertTrue(
    holidayDateInputSource.includes('formatDateFromIso(value, { dateFormat })') &&
      holidayDateInputSource.includes("type=\"text\"") &&
      holidayDateInputSource.includes('onChange(iso)'),
    'picker displays formatted text and emits ISO on select',
  )
  assertTrue(
    /^\d{4}-\d{2}-\d{2}$/.test(iso),
    'filter values remain ISO-safe YYYY-MM-DD',
  )
})

run('4. From/To Admin filters no longer use native type=date', () => {
  for (const file of adminFilterSources) {
    assertTrue(
      !file.source.includes('type="date"') && !file.source.includes("type='date'"),
      `${file.relative} has no native date input`,
    )
    assertTrue(
      file.source.includes('CompanyDateInput'),
      `${file.relative} uses CompanyDateInput`,
    )
  }
  assertTrue(
    companyDateInputSource.includes('HolidayDateInput as CompanyDateInput'),
    'CompanyDateInput reuses HolidayDateInput',
  )
})

run('5. Setting change updates rendering without logout', () => {
  const previous = getGlobalDateFormat()
  try {
    setGlobalDateFormat('DMY')
    assertEqual(
      formatDateFromIso(SAMPLE_ISO),
      '15/03/2026',
      'global DMY',
    )
    setGlobalDateFormat('MDY')
    assertEqual(
      formatDateFromIso(SAMPLE_ISO),
      '03/15/2026',
      'global MDY after change',
    )
    assertEqual(SAMPLE_ISO, '2026-03-15', 'ISO still preserved')
  } finally {
    setGlobalDateFormat(previous)
  }

  assertTrue(
    holidayDateInputSource.includes('useCompanySettings()') &&
      holidayDateInputSource.includes('dateFormat'),
    'picker reads live company dateFormat from context',
  )
  assertTrue(
    globalsSource.includes('applyGlobalDateTimeSettings') &&
      globalsSource.includes('dateFormat: settings.dateFormat'),
    'saving Regional settings applies global date format',
  )
})

console.log(`\nverify-company-date-format: ${passed} checks passed`)
