import type { Driver, DriverRole, LicenceCategory } from '@/services/driversService'
import { getDaysRemaining, getToday } from '@/lib/complianceUtils'

export const WORKER_LICENCE_CATEGORIES: LicenceCategory[] = ['C', 'C+E', 'B', 'Other']

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

export function normalizeLicenceCategories(
  value: string[] | null | undefined,
): LicenceCategory[] {
  if (!value?.length) return []
  const allowed = new Set<string>(WORKER_LICENCE_CATEGORIES)
  return value.filter((item): item is LicenceCategory => allowed.has(item))
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
  return categories.join(', ')
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
