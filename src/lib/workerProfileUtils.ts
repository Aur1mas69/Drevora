import type { Driver, DriverRole, LicenceCategory } from '@/services/driversService'
import type { VehicleCheckResult } from '@/lib/vehicleCheckTypes'
import { getDaysRemaining, getToday } from '@/lib/complianceUtils'

export const WORKER_PROFILE_HISTORY_LIMIT = 25

export type WorkerLicenceCategoryOption = {
  value: LicenceCategory
  label: string
  shortLabel: string
}

export const WORKER_LICENCE_CATEGORY_OPTIONS: WorkerLicenceCategoryOption[] = [
  { value: 'B', label: 'Car / Van (B)', shortLabel: 'B' },
  { value: 'C1', label: '7.5 Tonne (C1)', shortLabel: 'C1' },
  { value: 'C', label: 'HGV Class 2 (C)', shortLabel: 'Class 2' },
  { value: 'C+E', label: 'HGV Class 1 (C+E)', shortLabel: 'Class 1' },
  { value: 'D', label: 'PCV / Bus (D)', shortLabel: 'D' },
  { value: 'D1', label: 'Minibus (D1)', shortLabel: 'D1' },
  { value: 'B+E', label: 'Trailer (B+E)', shortLabel: 'B+E' },
  { value: 'Forklift', label: 'Forklift', shortLabel: 'Forklift' },
  { value: 'HIAB', label: 'HIAB / Grab', shortLabel: 'HIAB' },
  { value: 'ADR', label: 'ADR', shortLabel: 'ADR' },
  { value: 'Moffett', label: 'Moffett', shortLabel: 'Moffett' },
  { value: 'Other', label: 'Other', shortLabel: 'Other' },
]

export const WORKER_LICENCE_CATEGORIES: LicenceCategory[] =
  WORKER_LICENCE_CATEGORY_OPTIONS.map((option) => option.value)

const LICENCE_CATEGORY_OPTION_BY_VALUE = new Map(
  WORKER_LICENCE_CATEGORY_OPTIONS.map((option) => [option.value, option]),
)

const LEGACY_LICENCE_CATEGORY_ALIASES: Record<string, LicenceCategory> = {
  B: 'B',
  C1: 'C1',
  C: 'C',
  'C+E': 'C+E',
  CE: 'C+E',
  D: 'D',
  D1: 'D1',
  'B+E': 'B+E',
  BE: 'B+E',
  E: 'C+E',
  FORKLIFT: 'Forklift',
  HIAB: 'HIAB',
  'HIAB/GRAB': 'HIAB',
  ADR: 'ADR',
  MOFFETT: 'Moffett',
  OTHER: 'Other',
}

export const WORKER_COMPLIANCE_EXPIRY_DAYS = 30

export type WorkerComplianceStatus =
  | 'Compliant'
  | 'Expiring Soon'
  | 'Expired'
  | 'Missing Info'

export type WorkerExpiryDateStatus = 'valid' | 'expiring' | 'expired' | 'missing'

const DRIVING_COMPLIANCE_ROLES: DriverRole[] = ['Driver', 'Transport Manager']

export const workerComplianceStatusClassMap: Record<WorkerComplianceStatus, string> = {
  Compliant:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
  'Expiring Soon':
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  Expired:
    'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
  'Missing Info':
    'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10',
}

export const workerExpiryDateClassMap: Record<WorkerExpiryDateStatus, string> = {
  valid: 'text-emerald-700 dark:text-emerald-300',
  expiring: 'text-amber-700 dark:text-amber-300',
  expired: 'text-rose-700 dark:text-rose-300',
  missing: 'text-slate-400 dark:text-slate-500',
}

function normalizeLicenceCategoryKey(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

export function normalizeLicenceCategory(
  value: string | null | undefined,
): LicenceCategory | null {
  if (!value?.trim()) return null

  const trimmed = value.trim()
  if (LICENCE_CATEGORY_OPTION_BY_VALUE.has(trimmed as LicenceCategory)) {
    return trimmed as LicenceCategory
  }

  const aliasKey = normalizeLicenceCategoryKey(trimmed)
  const aliased = LEGACY_LICENCE_CATEGORY_ALIASES[aliasKey]
  if (aliased) return aliased

  const caseInsensitiveMatch = WORKER_LICENCE_CATEGORY_OPTIONS.find(
    (option) => option.value.toUpperCase() === aliasKey,
  )
  return caseInsensitiveMatch?.value ?? null
}

export function normalizeLicenceCategories(
  value: string[] | null | undefined,
): LicenceCategory[] {
  if (!value?.length) return []

  const seen = new Set<LicenceCategory>()
  const result: LicenceCategory[] = []

  for (const item of value) {
    const normalized = normalizeLicenceCategory(item)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }

  return result
}

export function formatLicenceCategoryLabel(
  category: LicenceCategory | string,
): string {
  const normalized = normalizeLicenceCategory(category)
  const key = normalized ?? category
  return LICENCE_CATEGORY_OPTION_BY_VALUE.get(key as LicenceCategory)?.label ?? String(category).trim()
}

export function formatLicenceCategoryShortLabel(
  category: LicenceCategory | string,
): string {
  const normalized = normalizeLicenceCategory(category)
  const key = normalized ?? category
  return (
    LICENCE_CATEGORY_OPTION_BY_VALUE.get(key as LicenceCategory)?.shortLabel ??
    formatLicenceCategoryLabel(category)
  )
}

export function getWorkerExpiryDateStatus(
  value: string | null | undefined,
): WorkerExpiryDateStatus {
  if (!value) return 'missing'
  const daysRemaining = getDaysRemaining(value)
  if (daysRemaining === null) return 'missing'
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= WORKER_COMPLIANCE_EXPIRY_DAYS) return 'expiring'
  return 'valid'
}

function getKeyComplianceDates(driver: Pick<
  Driver,
  | 'role'
  | 'drivingLicenceExpiry'
  | 'cpcExpiry'
  | 'driverCardExpiry'
  | 'medicalExpiry'
>): (string | null)[] {
  return [
    driver.drivingLicenceExpiry,
    driver.cpcExpiry,
    driver.driverCardExpiry,
    driver.medicalExpiry,
  ]
}

export function computeWorkerComplianceStatus(
  driver: Pick<
    Driver,
    | 'role'
    | 'drivingLicenceExpiry'
    | 'cpcExpiry'
    | 'driverCardExpiry'
    | 'medicalExpiry'
  >,
): WorkerComplianceStatus {
  const dates = getKeyComplianceDates(driver).filter(Boolean) as string[]

  for (const date of dates) {
    if (getWorkerExpiryDateStatus(date) === 'expired') return 'Expired'
  }

  for (const date of dates) {
    if (getWorkerExpiryDateStatus(date) === 'expiring') return 'Expiring Soon'
  }

  if (DRIVING_COMPLIANCE_ROLES.includes(driver.role)) {
    const requiredDates = getKeyComplianceDates(driver)
    if (requiredDates.some((date) => !date)) return 'Missing Info'
  }

  return 'Compliant'
}

export function getWorkerDefaultVehicleLabel(
  driver: Pick<Driver, 'defaultVehicleRegistration' | 'assignment'>,
): string {
  return (
    driver.defaultVehicleRegistration?.trim() ||
    driver.assignment?.trim() ||
    'Not assigned'
  )
}

export function formatWorkerProfileDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

export function formatLicenceCategories(
  categories: LicenceCategory[] | null | undefined,
): string {
  if (!categories?.length) return 'Not set'
  return categories.map((category) => formatLicenceCategoryLabel(category)).join(', ')
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function isPastDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return false
  return parsed.getTime() < getToday().getTime()
}

export const WORKER_EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Umbrella',
  'Agency',
  'Self-employed / Contractor',
  'Zero-hours',
  'Temporary',
  'Casual',
  'Other',
] as const

export type EmploymentType = (typeof WORKER_EMPLOYMENT_TYPES)[number]

export function isEmploymentType(value: string | null | undefined): value is EmploymentType {
  if (!value) return false
  return (WORKER_EMPLOYMENT_TYPES as readonly string[]).includes(value)
}

export function formatEmploymentType(
  value: EmploymentType | null | undefined,
): string {
  return value ?? 'Not set'
}

export function isWorkerAddressEmpty(
  driver: Pick<
    Driver,
    | 'addressLine1'
    | 'addressLine2'
    | 'townCity'
    | 'county'
    | 'postcode'
    | 'country'
  >,
): boolean {
  return ![
    driver.addressLine1,
    driver.addressLine2,
    driver.townCity,
    driver.county,
    driver.postcode,
    driver.country,
  ].some((value) => value?.trim())
}

export function formatVehicleCheckResultLabel(result: VehicleCheckResult): string {
  switch (result) {
    case 'Pass':
      return 'Passed'
    case 'Advisory':
      return 'Issue'
    case 'Fail':
      return 'Failed'
  }
}

export const employmentTypeClassMap: Record<EmploymentType, string> = {
  'Full-time': 'bg-[#E8F3FE] text-[#0B68BE] ring-[#C5DFFB]/70',
  'Part-time': 'bg-sky-50 text-sky-700 ring-sky-200',
  Umbrella: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  Agency: 'bg-violet-50 text-violet-700 ring-violet-200',
  'Self-employed / Contractor': 'bg-purple-50 text-purple-700 ring-purple-200',
  'Zero-hours': 'bg-amber-50 text-amber-800 ring-amber-200',
  Temporary: 'bg-orange-50 text-orange-700 ring-orange-200',
  Casual: 'bg-teal-50 text-teal-700 ring-teal-200',
  Other: 'bg-slate-50 text-slate-600 ring-slate-200',
}
