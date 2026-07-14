import {
  getVerifiedCompanyName,
  requireVerifiedCompanyId,
} from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import {
  generateWorkerCodeCandidate,
  isValidWorkerCode,
  normalizeWorkerCompanyScope,
  workerNeedsWorkerCode,
} from '@/lib/workerCodeUtils'
import { normalizeLicenceCategories, isEmploymentType } from '@/lib/workerProfileUtils'

export type DriverStatus = 'Working' | 'Off Duty' | 'Holiday' | 'Suspended'
export type LicenceCategory =
  | 'B'
  | 'C1'
  | 'C'
  | 'C+E'
  | 'D'
  | 'D1'
  | 'B+E'
  | 'Forklift'
  | 'HIAB'
  | 'ADR'
  | 'Moffett'
  | 'Other'
export type DriverRole =
  | 'Admin'
  | 'Driver'
  | 'Yardman'
  | 'Cleaner'
  | 'Supervisor'
  | 'Mechanic'
  | 'Transport Manager'
  | 'Planner'
  | 'Office Staff'
  | 'Warehouse'
  | 'Other'

export type EmploymentType =
  | 'Full-time'
  | 'Part-time'
  | 'Umbrella'
  | 'Agency'
  | 'Self-employed / Contractor'
  | 'Zero-hours'
  | 'Temporary'
  | 'Casual'
  | 'Other'

export type Driver = {
  id: string
  createdAt: string
  workerCode: string | null
  firstName: string
  lastName: string
  email: string
  phone: string | null
  company: string
  role: DriverRole
  employmentType: EmploymentType | null
  paidHolidayEnabled: boolean | null
  annualPaidHolidayDays: number | null
  bankHolidayEntitlementDays: number | null
  unpaidLeaveAllowed: boolean
  holidayEntitlementNotes: string | null
  assignment: string | null
  status: DriverStatus
  licenceCategories: LicenceCategory[]
  drivingLicenceExpiry: string | null
  driving_licence_expiry: string | null
  tachoCardNumber: string | null
  cpcExpiry: string | null
  driverCardExpiry: string | null
  medicalExpiry: string | null
  adrExpiry: string | null
  hiabExpiry: string | null
  defaultVehicleId: string | null
  defaultVehicleRegistration: string | null
  startDate: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  addressLine1: string | null
  addressLine2: string | null
  townCity: string | null
  county: string | null
  postcode: string | null
  country: string | null
  avatarUrl: string | null
}

export type CreateDriverInput = {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: DriverRole
  status: DriverStatus
  employmentType: string
  paidHolidayEnabled: boolean | null | string
  annualPaidHolidayDays: string
  bankHolidayEntitlementDays: string
  unpaidLeaveAllowed: boolean | string
  holidayEntitlementNotes: string
  licenceCategories: LicenceCategory[]
  drivingLicenceExpiry: string
  tachoCardNumber: string
  driverCardExpiry: string
  cpcExpiry: string
  medicalExpiry: string
  defaultVehicleId: string
  startDate: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
  addressLine1: string
  addressLine2: string
  townCity: string
  county: string
  postcode: string
  country: string
}

export type UpdateDriverInput = CreateDriverInput

export type UpdateWorkerHolidayEntitlementInput = {
  paidHolidayEnabled: boolean | null
  annualPaidHolidayDays: string
  bankHolidayEntitlementDays: string
  unpaidLeaveAllowed: boolean
  holidayEntitlementNotes: string
}

export const emptyCreateDriverInput: CreateDriverInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  role: 'Driver',
  status: 'Off Duty',
  employmentType: '',
  paidHolidayEnabled: null,
  annualPaidHolidayDays: '',
  bankHolidayEntitlementDays: '',
  unpaidLeaveAllowed: true,
  holidayEntitlementNotes: '',
  licenceCategories: [],
  drivingLicenceExpiry: '',
  tachoCardNumber: '',
  driverCardExpiry: '',
  cpcExpiry: '',
  medicalExpiry: '',
  defaultVehicleId: '',
  startDate: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  addressLine1: '',
  addressLine2: '',
  townCity: '',
  county: '',
  postcode: '',
  country: 'United Kingdom',
}

type DriverRow = {
  id: string
  created_at: string
  worker_code?: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  role: string | null
  employment_type?: string | null
  paid_holiday_enabled?: boolean | null
  annual_paid_holiday_days?: number | string | null
  bank_holiday_entitlement_days?: number | string | null
  unpaid_leave_allowed?: boolean | null
  holiday_entitlement_notes?: string | null
  assigned_vehicle?: string | null
  status: string | null
  licence_categories?: string[] | null
  driving_licence_expiry?: string | null
  tacho_card_number?: string | null
  cpc_expiry?: string | null
  driver_card_expiry?: string | null
  medical_expiry?: string | null
  adr_expiry?: string | null
  hiab_expiry?: string | null
  default_vehicle_id?: string | null
  start_date?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relationship?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  town_city?: string | null
  county?: string | null
  postcode?: string | null
  country?: string | null
  avatar_url: string | null
}

const basicDriverSelectMinimal =
  'id, created_at, first_name, last_name, email, phone, company, role, status, avatar_url'

const basicDriverSelectLegacy =
  'id, created_at, first_name, last_name, email, phone, company, role, employment_type, status, avatar_url'

const basicDriverSelectWithAssignmentLegacy =
  'id, created_at, first_name, last_name, email, phone, company, role, employment_type, assigned_vehicle, status, avatar_url'

const workerCoreSelect =
  'id, created_at, worker_code, first_name, last_name, email, phone, company, role, employment_type, paid_holiday_enabled, annual_paid_holiday_days, bank_holiday_entitlement_days, unpaid_leave_allowed, holiday_entitlement_notes, assigned_vehicle, status, avatar_url'

const workerProfileSelect =
  'id, created_at, worker_code, first_name, last_name, email, phone, company, role, employment_type, paid_holiday_enabled, annual_paid_holiday_days, bank_holiday_entitlement_days, unpaid_leave_allowed, holiday_entitlement_notes, assigned_vehicle, status, avatar_url, licence_categories, driving_licence_expiry, tacho_card_number, cpc_expiry, driver_card_expiry, medical_expiry, adr_expiry, hiab_expiry, default_vehicle_id, start_date, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, address_line_1, address_line_2, town_city, county, postcode, country'

const complianceDriverSelect =
  'id, created_at, worker_code, first_name, last_name, email, phone, company, role, employment_type, assigned_vehicle, status, avatar_url, driving_licence_expiry, cpc_expiry, driver_card_expiry, medical_expiry, adr_expiry, hiab_expiry'

const complianceDriverSelectLegacy =
  'id, created_at, first_name, last_name, email, phone, company, role, employment_type, status, driving_licence_expiry, cpc_expiry, driver_card_expiry, medical_expiry, adr_expiry, hiab_expiry, avatar_url'

export class DriversServiceError extends Error {
  readonly code: string | null

  constructor(message: string, code: string | null = null) {
    super(message)
    this.name = 'DriversServiceError'
    this.code = code
  }
}

function isDriverStatus(value: string | null): value is DriverStatus {
  return (
    value === 'Working' ||
    value === 'Off Duty' ||
    value === 'Holiday' ||
    value === 'Suspended'
  )
}

function isDriverRole(value: string | null): value is DriverRole {
  return (
    value === 'Admin' ||
    value === 'Driver' ||
    value === 'Yardman' ||
    value === 'Cleaner' ||
    value === 'Supervisor' ||
    value === 'Mechanic' ||
    value === 'Transport Manager' ||
    value === 'Planner' ||
    value === 'Office Staff' ||
    value === 'Warehouse' ||
    value === 'Other'
  )
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function emptyDateToNull(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const parsed = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return trimmed
}

function emptyUuidToNull(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed,
    )
  ) {
    return null
  }
  return trimmed
}

function optionalNumberToNull(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function optionalBooleanToNull(value: boolean | string | null | undefined): boolean | null {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return null
}

function booleanWithDefault(value: boolean | string | null | undefined, fallback: boolean): boolean {
  return optionalBooleanToNull(value) ?? fallback
}

function resolveEmploymentType(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return isEmploymentType(trimmed) ? trimmed : null
}

function resolveCountry(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function mapEmploymentTypeFromRow(
  value: string | null | undefined,
): EmploymentType | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (isEmploymentType(trimmed)) return trimmed
  return 'Other'
}

function nullableNumberFromRow(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function resolveWorkerEmail(input: CreateDriverInput): string {
  const email = input.email.trim().toLowerCase()
  if (email) return email

  const slug =
    `${input.firstName}-${input.lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'worker'

  return `${slug}-${Date.now()}@workers.internal`
}

type SupabaseWriteError = {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | null
}

function logSupabaseWriteError(
  operation: string,
  payload: Record<string, unknown>,
  error: SupabaseWriteError,
  attempt: number,
) {
  if (!import.meta.env.DEV) return

  console.error(`[driversService.${operation}] Supabase write failed`, {
    attempt,
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    payload,
  })
}

function extractMissingColumn(error: SupabaseWriteError): string | null {
  const message = error.message ?? ''
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" (?:of relation|does not exist)/i,
    /column ([a-z_][a-z0-9_]*) does not exist/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

function isMissingColumnWriteError(error: SupabaseWriteError): boolean {
  const message = (error.message ?? '').toLowerCase()
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find the') ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

function isForeignKeyWriteError(error: SupabaseWriteError): boolean {
  const message = (error.message ?? '').toLowerCase()
  return error.code === '23503' || message.includes('foreign key')
}

function isUniqueViolationError(error: SupabaseWriteError): boolean {
  const message = (error.message ?? '').toLowerCase()
  return (
    error.code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  )
}

function formatWriteErrorMessage(error: SupabaseWriteError): string {
  const parts = [error.message, error.details, error.hint].filter(Boolean)
  return parts.join(' — ') || 'Unable to save worker.'
}

function buildFullWritePayload(input: CreateDriverInput): Record<string, unknown> {
  return {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: resolveWorkerEmail(input),
    phone: emptyToNull(input.phone),
    company: emptyToNull(input.company),
    role: input.role,
    status: input.status,
    employment_type: resolveEmploymentType(input.employmentType),
    paid_holiday_enabled: optionalBooleanToNull(input.paidHolidayEnabled),
    annual_paid_holiday_days: optionalNumberToNull(input.annualPaidHolidayDays),
    bank_holiday_entitlement_days: optionalNumberToNull(input.bankHolidayEntitlementDays),
    unpaid_leave_allowed: booleanWithDefault(input.unpaidLeaveAllowed, true),
    holiday_entitlement_notes: emptyToNull(input.holidayEntitlementNotes),
    licence_categories:
      input.licenceCategories.length > 0 ? input.licenceCategories : null,
    driving_licence_expiry: emptyDateToNull(input.drivingLicenceExpiry),
    tacho_card_number: emptyToNull(input.tachoCardNumber),
    cpc_expiry: emptyDateToNull(input.cpcExpiry),
    driver_card_expiry: emptyDateToNull(input.driverCardExpiry),
    medical_expiry: emptyDateToNull(input.medicalExpiry),
    default_vehicle_id: emptyUuidToNull(input.defaultVehicleId),
    start_date: emptyDateToNull(input.startDate),
    emergency_contact_name: emptyToNull(input.emergencyContactName),
    emergency_contact_phone: emptyToNull(input.emergencyContactPhone),
    emergency_contact_relationship: emptyToNull(
      input.emergencyContactRelationship,
    ),
    address_line_1: emptyToNull(input.addressLine1),
    address_line_2: emptyToNull(input.addressLine2),
    town_city: emptyToNull(input.townCity),
    county: emptyToNull(input.county),
    postcode: emptyToNull(input.postcode),
    country: resolveCountry(input.country),
  }
}

const CORE_WRITE_FIELDS = new Set([
  'first_name',
  'last_name',
  'email',
  'status',
  // Tenant key must never be stripped by the missing-column fallback loop.
  'company_id',
])

const OPTIONAL_FIELD_STRIP_ORDER = [
  'licence_categories',
  'tacho_card_number',
  'default_vehicle_id',
  'start_date',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relationship',
  'address_line_1',
  'address_line_2',
  'town_city',
  'county',
  'postcode',
  'country',
  'driving_licence_expiry',
  'cpc_expiry',
  'driver_card_expiry',
  'medical_expiry',
  'phone',
  'company',
  'role',
  'paid_holiday_enabled',
  'annual_paid_holiday_days',
  'bank_holiday_entitlement_days',
  'unpaid_leave_allowed',
  'holiday_entitlement_notes',
] as const

async function fetchWorkerCodesForCompany(company: string): Promise<Set<string>> {
  const scope = normalizeWorkerCompanyScope(company)
  let query = requireSupabase()
    .from('drivers')
    .select('worker_code')
    .not('worker_code', 'is', null)

  query =
    scope.length > 0
      ? query.eq('company', scope)
      : query.or('company.is.null,company.eq.')

  const { data, error } = await query

  if (error) {
    if (isMissingColumnWriteError(error)) {
      return new Set()
    }
    throw error
  }

  return new Set(
    (data ?? [])
      .map((row) => row.worker_code?.trim())
      .filter((code): code is string => Boolean(code)),
  )
}

async function generateUniqueWorkerCode(company: string): Promise<string> {
  const existingCodes = await fetchWorkerCodesForCompany(company)

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = generateWorkerCodeCandidate()
    if (!existingCodes.has(candidate)) {
      return candidate
    }
  }

  throw new DriversServiceError(
    'Unable to generate a unique Worker ID for this company.',
  )
}

async function persistWorkerCodeIfNeeded(driver: Driver): Promise<Driver> {
  if (isValidWorkerCode(driver.workerCode)) {
    return driver
  }

  const replacingInvalid = Boolean(driver.workerCode?.trim())

  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const worker_code = await generateUniqueWorkerCode(driver.company)

      let query = requireSupabase()
        .from('drivers')
        .update({ worker_code })
        .eq('id', driver.id)

      if (!replacingInvalid) {
        query = query.or('worker_code.is.null,worker_code.eq.')
      }

      const { data, error } = await query.select('worker_code').maybeSingle()

      if (!error && isValidWorkerCode(data?.worker_code)) {
        return {
          ...driver,
          workerCode: data!.worker_code!.trim(),
        }
      }

      if (error) {
        if (isMissingColumnWriteError(error)) {
          return driver
        }

        if (isUniqueViolationError(error)) {
          continue
        }

        if (import.meta.env.DEV) {
          console.warn('[driversService] worker_code backfill failed', {
            driverId: driver.id,
            message: error.message,
            code: error.code,
          })
        }

        return driver
      }

      const refreshed = await fetchDriverRowById(driver.id)
      if (isValidWorkerCode(refreshed?.workerCode)) {
        return refreshed!
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[driversService] worker_code backfill error', error)
    }
  }

  return driver
}

async function ensureWorkerCodesForDrivers(drivers: Driver[]): Promise<Driver[]> {
  const needsCode = drivers.some((driver) => workerNeedsWorkerCode(driver.workerCode))
  if (!needsCode) {
    return drivers
  }

  return Promise.all(drivers.map((driver) => persistWorkerCodeIfNeeded(driver)))
}

async function writeDriverPayloadWithFallback(
  operation: 'insert' | 'update',
  input: CreateDriverInput,
  companyId: string,
  id?: string,
  insertExtras?: Record<string, unknown>,
): Promise<string | void> {
  const basePayload = buildFullWritePayload(input)
  const excludedFields = new Set<string>()
  let clearedDefaultVehicle = false
  let skipInsertWorkerCode = false
  let lastError: SupabaseWriteError | null = null

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const payload: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(basePayload)) {
      if (!excludedFields.has(key)) {
        payload[key] = value
      }
    }

    if (clearedDefaultVehicle) {
      payload.default_vehicle_id = null
    }

    if (operation === 'insert') {
      payload.avatar_url = null
      if (insertExtras) {
        Object.assign(payload, insertExtras)
        if (skipInsertWorkerCode) {
          delete payload.worker_code
        }
      }
    }

    const query =
      operation === 'insert'
        ? requireSupabase().from('drivers').insert(payload).select('id').single()
        : requireSupabase()
            .from('drivers')
            .update(payload)
            .eq('id', id ?? '')
            .eq('company_id', companyId)
            .select('id')

    const { data, error } = await query

    if (!error) {
      if (operation === 'insert') {
        if (!(data as { id?: string } | null)?.id) {
          throw new DriversServiceError('Worker was created but no id was returned.')
        }
        return (data as { id: string }).id
      }
      // Update: zero affected rows means the row is not in this company (or gone).
      const updatedRows = (data ?? []) as Array<{ id: string }>
      if (updatedRows.length === 0) {
        throw new DriversServiceError(
          'Worker could not be updated for your company. Refresh and try again.',
        )
      }
      return
    }

    logSupabaseWriteError(
      operation === 'insert' ? 'createDriver' : 'updateDriver',
      payload,
      error,
      attempt + 1,
    )
    lastError = error

    const missingColumn = extractMissingColumn(error)
    if (
      missingColumn &&
      missingColumn in payload &&
      !CORE_WRITE_FIELDS.has(missingColumn)
    ) {
      excludedFields.add(missingColumn)
      continue
    }

    if (isMissingColumnWriteError(error)) {
      const nextField = OPTIONAL_FIELD_STRIP_ORDER.find(
        (field) => field in payload && !excludedFields.has(field),
      )
      if (nextField) {
        excludedFields.add(nextField)
        continue
      }
    }

    if (
      isForeignKeyWriteError(error) &&
      'default_vehicle_id' in payload &&
      !clearedDefaultVehicle
    ) {
      clearedDefaultVehicle = true
      continue
    }

    if (
      operation === 'insert' &&
      insertExtras?.worker_code &&
      isMissingColumnWriteError(error) &&
      extractMissingColumn(error) === 'worker_code'
    ) {
      skipInsertWorkerCode = true
      continue
    }

    break
  }

  throw new DriversServiceError(
    formatWriteErrorMessage(lastError ?? { message: 'Unable to save worker.' }),
    lastError?.code ?? null,
  )
}

async function persistEmploymentType(
  id: string,
  input: CreateDriverInput,
  companyId: string,
): Promise<void> {
  const employment_type = resolveEmploymentType(input.employmentType)
  const payload = { employment_type }

  const { error } = await requireSupabase()
    .from('drivers')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)

  if (!error) return

  if (import.meta.env.DEV) {
    console.warn('[driversService] employment_type save failed', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      payload,
    })
  }

  if (!isMissingColumnWriteError(error)) {
    throw new DriversServiceError(formatWriteErrorMessage(error))
  }
}

async function createDriverRecord(
  input: CreateDriverInput,
  companyId: string,
  companyName: string | null,
): Promise<string> {
  // worker_code uniqueness scope is preserved (legacy company text) per spec.
  const company = normalizeWorkerCompanyScope(companyName ?? input.company)
  let workerCodeColumnMissing = false

  for (let attempt = 0; attempt < 100; attempt += 1) {
    // Authoritative tenant key + transitional legacy company text.
    // Neither comes from user-editable form input.
    const tenantExtras: Record<string, unknown> = {
      company_id: companyId,
      company: companyName,
    }
    const insertExtras = workerCodeColumnMissing
      ? tenantExtras
      : { ...tenantExtras, worker_code: await generateUniqueWorkerCode(company) }

    try {
      const insertedId = await writeDriverPayloadWithFallback(
        'insert',
        input,
        companyId,
        undefined,
        insertExtras,
      )

      if (!insertedId) {
        throw new DriversServiceError('Unable to save worker.')
      }

      await persistEmploymentType(insertedId, input, companyId)
      return insertedId
    } catch (error) {
      if (
        error instanceof DriversServiceError &&
        isUniqueViolationError({ code: error.code, message: error.message }) &&
        !workerCodeColumnMissing
      ) {
        continue
      }

      if (
        error instanceof DriversServiceError &&
        isMissingColumnWriteError({
          code: error.code,
          message: error.message,
        }) &&
        error.message.toLowerCase().includes('worker_code')
      ) {
        workerCodeColumnMissing = true
        continue
      }

      throw error
    }
  }

  throw new DriversServiceError(
    'Unable to generate a unique Worker ID for this worker.',
  )
}

async function updateDriverRecord(
  id: string,
  input: UpdateDriverInput,
  companyId: string,
  companyName: string | null,
): Promise<void> {
  // Preserve verified tenant text; company_id itself is never changed on update
  // (it is only used as the .eq scope inside writeDriverPayloadWithFallback).
  const scopedInput: UpdateDriverInput = {
    ...input,
    company: companyName ?? input.company,
  }
  await writeDriverPayloadWithFallback('update', scopedInput, companyId, id)
  await persistEmploymentType(id, input, companyId)
}

async function fetchDefaultVehicleRegistrationMap(
  vehicleIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(vehicleIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return new Map()
  }

  try {
    const { data, error } = await requireSupabase()
      .from('vehicles')
      .select('id, registration')
      .in('id', uniqueIds)

    if (error) {
      return new Map()
    }

    return new Map(
      (data ?? []).map((row) => [
        row.id as string,
        (row.registration as string)?.trim() || '',
      ]),
    )
  } catch {
    return new Map()
  }
}

async function enrichDriversWithDefaultVehicles(drivers: Driver[]): Promise<Driver[]> {
  const vehicleMap = await fetchDefaultVehicleRegistrationMap(
    drivers
      .map((driver) => driver.defaultVehicleId)
      .filter((id): id is string => Boolean(id)),
  )

  if (vehicleMap.size === 0) {
    return drivers
  }

  return drivers.map((driver) => {
    if (!driver.defaultVehicleId) {
      return driver
    }

    const registration = vehicleMap.get(driver.defaultVehicleId)?.trim()
    if (!registration) {
      return driver
    }

    return {
      ...driver,
      defaultVehicleRegistration: registration,
    }
  })
}

function mapDriverRow(row: DriverRow): Driver {
  return {
    id: row.id,
    createdAt: row.created_at,
    workerCode: row.worker_code?.trim() || null,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    company: row.company ?? '',
    role: isDriverRole(row.role) ? row.role : 'Driver',
    employmentType: mapEmploymentTypeFromRow(row.employment_type),
    paidHolidayEnabled: row.paid_holiday_enabled ?? null,
    annualPaidHolidayDays: nullableNumberFromRow(row.annual_paid_holiday_days),
    bankHolidayEntitlementDays: nullableNumberFromRow(row.bank_holiday_entitlement_days),
    unpaidLeaveAllowed: row.unpaid_leave_allowed ?? true,
    holidayEntitlementNotes: row.holiday_entitlement_notes?.trim() || null,
    assignment: row.assigned_vehicle?.trim() || null,
    status: isDriverStatus(row.status) ? row.status : 'Off Duty',
    licenceCategories: normalizeLicenceCategories(row.licence_categories),
    drivingLicenceExpiry: row.driving_licence_expiry ?? null,
    driving_licence_expiry: row.driving_licence_expiry ?? null,
    tachoCardNumber: row.tacho_card_number?.trim() || null,
    cpcExpiry: row.cpc_expiry ?? null,
    driverCardExpiry: row.driver_card_expiry ?? null,
    medicalExpiry: row.medical_expiry ?? null,
    adrExpiry: row.adr_expiry ?? null,
    hiabExpiry: row.hiab_expiry ?? null,
    defaultVehicleId: row.default_vehicle_id ?? null,
    defaultVehicleRegistration: null,
    startDate: row.start_date ?? null,
    emergencyContactName: row.emergency_contact_name?.trim() || null,
    emergencyContactPhone: row.emergency_contact_phone?.trim() || null,
    emergencyContactRelationship:
      row.emergency_contact_relationship?.trim() || null,
    addressLine1: row.address_line_1?.trim() || null,
    addressLine2: row.address_line_2?.trim() || null,
    townCity: row.town_city?.trim() || null,
    county: row.county?.trim() || null,
    postcode: row.postcode?.trim() || null,
    country: row.country?.trim() || null,
    avatarUrl: row.avatar_url,
  }
}

async function queryDrivers(select: string): Promise<Driver[]> {
  const companyId = requireVerifiedCompanyId()
  const pageSize = 1000
  let from = 0
  const rows: unknown[] = []

  // Page through results so PostgREST max-rows never silently truncates the workers list.
  while (true) {
    const { data, error } = await requireSupabase()
      .from('drivers')
      .select(select)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) {
      throw error
    }

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return enrichDriversWithDefaultVehicles(
    rows.map((row) => mapDriverRow(row as unknown as DriverRow)),
  )
}

function isInternalPlaceholderEmail(email: string): boolean {
  return email.endsWith('@workers.internal')
}

export function getDriverFormValues(driver: Driver): CreateDriverInput {
  return {
    firstName: driver.firstName,
    lastName: driver.lastName,
    email: isInternalPlaceholderEmail(driver.email) ? '' : driver.email,
    phone: driver.phone ?? '',
    company: driver.company,
    role: driver.role,
    status: driver.status,
    employmentType: driver.employmentType ?? '',
    paidHolidayEnabled: driver.paidHolidayEnabled,
    annualPaidHolidayDays: driver.annualPaidHolidayDays == null ? '' : String(driver.annualPaidHolidayDays),
    bankHolidayEntitlementDays:
      driver.bankHolidayEntitlementDays == null ? '' : String(driver.bankHolidayEntitlementDays),
    unpaidLeaveAllowed: driver.unpaidLeaveAllowed,
    holidayEntitlementNotes: driver.holidayEntitlementNotes ?? '',
    licenceCategories: driver.licenceCategories,
    drivingLicenceExpiry: driver.drivingLicenceExpiry ?? '',
    tachoCardNumber: driver.tachoCardNumber ?? '',
    driverCardExpiry: driver.driverCardExpiry ?? '',
    cpcExpiry: driver.cpcExpiry ?? '',
    medicalExpiry: driver.medicalExpiry ?? '',
    defaultVehicleId: driver.defaultVehicleId ?? '',
    startDate: driver.startDate ?? '',
    emergencyContactName: driver.emergencyContactName ?? '',
    emergencyContactPhone: driver.emergencyContactPhone ?? '',
    emergencyContactRelationship: driver.emergencyContactRelationship ?? '',
    addressLine1: driver.addressLine1 ?? '',
    addressLine2: driver.addressLine2 ?? '',
    townCity: driver.townCity ?? '',
    county: driver.county ?? '',
    postcode: driver.postcode ?? '',
    country: driver.country ?? 'United Kingdom',
  }
}

async function mapDriverRows(rows: unknown[]): Promise<Driver[]> {
  return enrichDriversWithDefaultVehicles(
    rows.map((row) => mapDriverRow(row as unknown as DriverRow)),
  )
}

export async function fetchDrivers(): Promise<Driver[]> {
  const table = 'drivers'
  // Fail closed before any query if there is no verified company membership.
  const companyId = requireVerifiedCompanyId()

  try {
    const drivers = await ensureWorkerCodesForDrivers(await queryDrivers(workerProfileSelect))
    logSupabaseQuery({
      service: 'driversService.fetchDrivers',
      table,
      data: drivers,
      error: null,
    })
    return drivers
  } catch {
    try {
      const drivers = await ensureWorkerCodesForDrivers(await queryDrivers(workerCoreSelect))
      logSupabaseQuery({
        service: 'driversService.fetchDrivers',
        table,
        data: drivers,
        error: null,
      })
      return drivers
    } catch {
      try {
        const drivers = await ensureWorkerCodesForDrivers(
          await queryDrivers(complianceDriverSelect),
        )
        logSupabaseQuery({
          service: 'driversService.fetchDrivers',
          table,
          data: drivers,
          error: null,
        })
        return drivers
      } catch {
        const fallback = await requireSupabase()
          .from(table)
          .select(basicDriverSelectWithAssignmentLegacy)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        logSupabaseQuery({
          service: 'driversService.fetchDrivers',
          table,
          data: fallback.data,
          error: fallback.error,
        })

        if (!fallback.error) {
          return ensureWorkerCodesForDrivers(await mapDriverRows(fallback.data ?? []))
        }

        const legacyFallback = await requireSupabase()
          .from(table)
          .select(basicDriverSelectLegacy)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (!legacyFallback.error) {
          return ensureWorkerCodesForDrivers(await mapDriverRows(legacyFallback.data ?? []))
        }

        const minimalFallback = await requireSupabase()
          .from(table)
          .select(basicDriverSelectMinimal)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (minimalFallback.error) {
          throw new DriversServiceError(minimalFallback.error.message)
        }

        return ensureWorkerCodesForDrivers(await mapDriverRows(minimalFallback.data ?? []))
      }
    }
  }
}

export async function fetchDriversWithCompliance(): Promise<Driver[]> {
  const companyId = requireVerifiedCompanyId()
  try {
    return await queryDrivers(workerProfileSelect)
  } catch {
    try {
      return await queryDrivers(workerCoreSelect)
    } catch {
      try {
        return await queryDrivers(complianceDriverSelect)
      } catch {
        const fallback = await requireSupabase()
          .from('drivers')
          .select(complianceDriverSelectLegacy)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (fallback.error) {
          throw new DriversServiceError(fallback.error.message)
        }

        return ensureWorkerCodesForDrivers(await mapDriverRows(fallback.data ?? []))
      }
    }
  }
}

async function fetchDriverRowById(
  id: string,
  companyId?: string | null,
): Promise<Driver | null> {
  const attempts = [
    workerProfileSelect,
    workerCoreSelect,
    complianceDriverSelect,
    basicDriverSelectLegacy,
    basicDriverSelectMinimal,
  ]

  for (const select of attempts) {
    let request = requireSupabase()
      .from('drivers')
      .select(select)
      .eq('id', id)

    if (companyId) {
      request = request.eq('company_id', companyId)
    }

    const { data, error } = await request.maybeSingle()

    if (!error && data) {
      const [driver] = await enrichDriversWithDefaultVehicles([
        mapDriverRow(data as unknown as DriverRow),
      ])
      return driver ?? null
    }
  }

  return null
}

export async function fetchDriverById(id: string): Promise<Driver | null> {
  const companyId = requireVerifiedCompanyId()
  try {
    const driver = await fetchDriverRowById(id, companyId)
    if (!driver) return null
    return persistWorkerCodeIfNeeded(driver)
  } catch (error) {
    throw new DriversServiceError(
      error instanceof Error ? error.message : 'Unable to load worker.',
    )
  }
}

export async function fetchDriverByEmail(email: string): Promise<Driver | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return null

  const attempts = [
    workerProfileSelect,
    workerCoreSelect,
    complianceDriverSelect,
    basicDriverSelectLegacy,
    basicDriverSelectMinimal,
  ]

  try {
    for (const select of attempts) {
      const { data, error } = await requireSupabase()
        .from('drivers')
        .select(select)
        .ilike('email', normalizedEmail)
        .maybeSingle()

      logSupabaseQuery({
        service: 'driversService.fetchDriverByEmail',
        table: 'drivers',
        data: data ? [data] : [],
        error,
      })

      if (!error && data) {
        const [driver] = await enrichDriversWithDefaultVehicles([
          mapDriverRow(data as unknown as DriverRow),
        ])
        if (!driver) return null
        return persistWorkerCodeIfNeeded(driver)
      }
    }

    return null
  } catch (error) {
    if (error instanceof DriversServiceError) throw error
    throw new DriversServiceError(
      error instanceof Error ? error.message : 'Unable to load worker profile.',
    )
  }
}

export async function createDriver(input: CreateDriverInput): Promise<Driver> {
  const companyId = requireVerifiedCompanyId()
  const companyName = getVerifiedCompanyName()
  const insertedId = await createDriverRecord(input, companyId, companyName)
  const driver = await fetchDriverRowById(insertedId, companyId)

  if (!driver) {
    throw new DriversServiceError('Worker was created but could not be loaded.')
  }

  return persistWorkerCodeIfNeeded(driver)
}

export async function updateDriver(
  id: string,
  input: UpdateDriverInput,
): Promise<Driver> {
  const companyId = requireVerifiedCompanyId()
  const companyName = getVerifiedCompanyName()
  await updateDriverRecord(id, input, companyId, companyName)

  const driver = await fetchDriverRowById(id, companyId)
  if (!driver) {
    throw new DriversServiceError('Worker was updated but could not be loaded.')
  }

  return persistWorkerCodeIfNeeded(driver)
}

export async function updateWorkerHolidayEntitlement(
  id: string,
  input: UpdateWorkerHolidayEntitlementInput,
): Promise<Driver> {
  const payload = {
    paid_holiday_enabled: input.paidHolidayEnabled,
    annual_paid_holiday_days: optionalNumberToNull(input.annualPaidHolidayDays),
    bank_holiday_entitlement_days: optionalNumberToNull(input.bankHolidayEntitlementDays),
    unpaid_leave_allowed: input.unpaidLeaveAllowed,
    holiday_entitlement_notes: emptyToNull(input.holidayEntitlementNotes),
  }

  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('drivers')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')

  if (error) {
    throw new DriversServiceError(formatWriteErrorMessage(error), error.code ?? null)
  }

  if ((data ?? []).length === 0) {
    throw new DriversServiceError(
      'Worker could not be updated for your company. Refresh and try again.',
    )
  }

  const driver = await fetchDriverRowById(id, companyId)
  if (!driver) {
    throw new DriversServiceError('Worker was updated but could not be loaded.')
  }

  return persistWorkerCodeIfNeeded(driver)
}

export async function updateWorkerAvatarUrl(
  id: string,
  avatarUrl: string | null,
): Promise<Driver> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('drivers')
    .update({ avatar_url: avatarUrl })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')

  if (error) {
    throw new DriversServiceError(error.message, error.code ?? null)
  }

  if ((data ?? []).length === 0) {
    throw new DriversServiceError(
      'Worker avatar could not be updated for your company. Refresh and try again.',
    )
  }

  const driver = await fetchDriverRowById(id, companyId)
  if (!driver) {
    throw new DriversServiceError('Worker was updated but could not be loaded.')
  }

  return persistWorkerCodeIfNeeded(driver)
}

export async function deleteDriver(id: string): Promise<void> {
  const companyId = requireVerifiedCompanyId()
  const { data, error } = await requireSupabase()
    .from('drivers')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id')

  if (error) {
    console.error('[driversService.deleteDriver] Supabase delete error:', error)
    throw new DriversServiceError(error.message)
  }

  if ((data ?? []).length === 0) {
    throw new DriversServiceError(
      'Worker could not be deleted for your company. Refresh and try again.',
    )
  }
}

export const driversService = {
  fetchDrivers,
  fetchDriversWithCompliance,
  fetchDriverById,
  fetchDriverByEmail,
  createDriver,
  updateDriver,
  updateWorkerHolidayEntitlement,
  updateWorkerAvatarUrl,
  deleteDriver,
  getDriverFormValues,
}
