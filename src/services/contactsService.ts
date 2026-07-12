import type {
  Contact,
  ContactSummaryCounts,
  ContactsPageResult,
  ContactsQuery,
  CreateContactInput,
  UpdateContactInput,
} from '@/lib/contactTypes'
import { DEFAULT_CONTACT_PAGE_SIZE } from '@/lib/contactTypes'
import { isContactCategory, isContactStatus } from '@/lib/contactUtils'
import { getGlobalCompanySettings } from '@/lib/companySettingsGlobals'
import { requireSupabase } from '@/lib/supabase'
import { logSupabaseQuery } from '@/lib/supabaseQueryLog'
import { fetchDrivers, type Driver } from '@/services/driversService'

type ContactRow = {
  id: string
  company: string | null
  name: string | null
  organisation: string | null
  category: string
  phone: string | null
  email: string | null
  website: string | null
  role_title: string | null
  vat_number: string | null
  account_reference: string | null
  address_line_1: string | null
  address_line_2: string | null
  town_city: string | null
  county: string | null
  postcode: string | null
  country: string | null
  notes: string | null
  status: string
  worker_id?: string | null
  created_at: string
  updated_at: string
}

const contactSelect = `
  id,
  company,
  name,
  organisation,
  category,
  phone,
  email,
  website,
  role_title,
  vat_number,
  account_reference,
  address_line_1,
  address_line_2,
  town_city,
  county,
  postcode,
  country,
  notes,
  status,
  worker_id,
  created_at,
  updated_at
`

const contactSelectLegacy = `
  id,
  company,
  name,
  organisation,
  category,
  phone,
  email,
  website,
  role_title,
  vat_number,
  account_reference,
  address_line_1,
  address_line_2,
  town_city,
  county,
  postcode,
  country,
  notes,
  status,
  created_at,
  updated_at
`

export class ContactsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContactsServiceError'
  }
}

function resolveCompanyScope(): string | null {
  const name = getGlobalCompanySettings()?.name?.trim()
  return name || null
}

function isInternalPlaceholderEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim().toLowerCase().endsWith('@workers.internal'))
}

function displayWorkerEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim() || null
  if (!trimmed || isInternalPlaceholderEmail(trimmed)) return null
  return trimmed
}

function mapDriverStatusToContactStatus(status: Driver['status']): Contact['status'] {
  return status === 'Suspended' ? 'inactive' : 'active'
}

function mapRow(row: ContactRow): Contact {
  return {
    id: row.id,
    company: row.company,
    name: row.name,
    organisation: row.organisation,
    category: isContactCategory(row.category) ? row.category : 'other',
    phone: row.phone,
    email: row.email,
    website: row.website,
    roleTitle: row.role_title,
    vatNumber: row.vat_number,
    accountReference: row.account_reference,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    townCity: row.town_city,
    county: row.county,
    postcode: row.postcode,
    country: row.country,
    notes: row.notes,
    status: isContactStatus(row.status) ? row.status : 'active',
    workerId: row.worker_id?.trim() || null,
    workerCode: null,
    source: 'contact',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDriverToWorkerContact(driver: Driver): Contact {
  const fullName = `${driver.firstName} ${driver.lastName}`.trim() || 'Unnamed worker'
  return {
    id: `worker:${driver.id}`,
    company: driver.company || null,
    name: fullName,
    organisation: null,
    category: 'worker',
    phone: driver.phone?.trim() || null,
    email: displayWorkerEmail(driver.email),
    website: null,
    roleTitle: driver.role || null,
    vatNumber: null,
    accountReference: driver.workerCode?.trim() || null,
    addressLine1: driver.addressLine1,
    addressLine2: driver.addressLine2,
    townCity: driver.townCity,
    county: driver.county,
    postcode: driver.postcode,
    country: driver.country,
    notes: null,
    status: mapDriverStatusToContactStatus(driver.status),
    workerId: driver.id,
    workerCode: driver.workerCode?.trim() || null,
    source: 'worker',
    createdAt: driver.createdAt,
    updatedAt: driver.createdAt,
  }
}

function isMissingContactsTableError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('contacts') &&
    (normalized.includes('does not exist') ||
      normalized.includes('could not find the table') ||
      normalized.includes('schema cache'))
  )
}

function isMissingWorkerIdColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('worker_id') &&
    (normalized.includes('does not exist') ||
      normalized.includes('schema cache') ||
      normalized.includes('could not find'))
  )
}

function contactMatchesSearch(contact: Contact, search: string): boolean {
  const term = search.trim().toLowerCase()
  if (!term) return true

  const haystack = [
    contact.name,
    contact.organisation,
    contact.phone,
    contact.email,
    contact.workerCode,
    contact.accountReference,
    contact.townCity,
    contact.postcode,
    contact.notes,
    contact.roleTitle,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(term)
}

function compareContacts(left: Contact, right: Contact): number {
  const leftName = (left.name ?? left.organisation ?? '').toLowerCase()
  const rightName = (right.name ?? right.organisation ?? '').toLowerCase()
  if (leftName !== rightName) return leftName.localeCompare(rightName)
  return left.id.localeCompare(right.id)
}

function toDbPayload(input: CreateContactInput | UpdateContactInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  if ('name' in input && input.name !== undefined) payload.name = input.name?.trim() || null
  if ('organisation' in input && input.organisation !== undefined) {
    payload.organisation = input.organisation?.trim() || null
  }
  if (input.category !== undefined) payload.category = input.category
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null
  if (input.email !== undefined) payload.email = input.email?.trim() || null
  if (input.website !== undefined) payload.website = input.website?.trim() || null
  if (input.roleTitle !== undefined) payload.role_title = input.roleTitle?.trim() || null
  if (input.vatNumber !== undefined) payload.vat_number = input.vatNumber?.trim() || null
  if (input.accountReference !== undefined) {
    payload.account_reference = input.accountReference?.trim() || null
  }
  if (input.addressLine1 !== undefined) payload.address_line_1 = input.addressLine1?.trim() || null
  if (input.addressLine2 !== undefined) payload.address_line_2 = input.addressLine2?.trim() || null
  if (input.townCity !== undefined) payload.town_city = input.townCity?.trim() || null
  if (input.county !== undefined) payload.county = input.county?.trim() || null
  if (input.postcode !== undefined) payload.postcode = input.postcode?.trim() || null
  if (input.country !== undefined) payload.country = input.country?.trim() || null
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null
  if (input.status !== undefined) payload.status = input.status
  if (input.workerId !== undefined) payload.worker_id = input.workerId?.trim() || null

  return payload
}

async function fetchContactRows(): Promise<ContactRow[]> {
  const company = resolveCompanyScope()

  async function runSelect(select: string) {
    let request = requireSupabase().from('contacts').select(select)
    if (company) request = request.eq('company', company)
    return request.order('name', { ascending: true, nullsFirst: false })
  }

  let { data, error } = await runSelect(contactSelect)

  if (error && isMissingWorkerIdColumnError(error.message)) {
    ;({ data, error } = await runSelect(contactSelectLegacy))
  }

  logSupabaseQuery({
    service: 'contactsService.fetchContactRows',
    table: 'contacts',
    data,
    error,
  })

  if (error) {
    if (isMissingContactsTableError(error.message)) {
      throw new ContactsServiceError(
        'Contacts table is not available yet. Run the contacts migration on your Supabase project.',
      )
    }
    if (isMissingWorkerIdColumnError(error.message)) {
      throw new ContactsServiceError(
        'Contacts worker link is not available yet. Run the contacts worker_id migration on your Supabase project.',
      )
    }
    throw new ContactsServiceError(error.message)
  }

  return (data ?? []) as unknown as ContactRow[]
}

async function fetchCompanyDrivers(): Promise<Driver[]> {
  const company = resolveCompanyScope()
  const drivers = await fetchDrivers()
  return drivers.filter((driver) => {
    if (!company) return true
    return driver.company?.trim() === company
  })
}

async function fetchCompanyWorkersWithPhone(): Promise<Driver[]> {
  const drivers = await fetchCompanyDrivers()
  return drivers.filter((driver) => Boolean(driver.phone?.trim()))
}

function buildDirectoryContacts(
  contactRows: ContactRow[],
  companyDrivers: Driver[],
): Contact[] {
  const workerById = new Map(companyDrivers.map((worker) => [worker.id, worker]))
  const contacts = contactRows.map((row) => {
    const mapped = mapRow(row)
    const linked = mapped.workerId ? workerById.get(mapped.workerId) : undefined
    if (!linked) return mapped
    return {
      ...mapped,
      workerCode: linked.workerCode?.trim() || mapped.workerCode,
    }
  })

  const linkedWorkerIds = new Set(
    contacts.map((contact) => contact.workerId).filter((id): id is string => Boolean(id)),
  )

  const workerContacts = companyDrivers
    .filter((driver) => Boolean(driver.phone?.trim()) && !linkedWorkerIds.has(driver.id))
    .map(mapDriverToWorkerContact)

  return [...contacts, ...workerContacts]
}

function filterDirectoryContacts(items: Contact[], query: ContactsQuery): Contact[] {
  let result = items

  if (query.category && query.category !== 'all') {
    result = result.filter((contact) => contact.category === query.category)
  }

  if (query.status && query.status !== 'all') {
    result = result.filter((contact) => contact.status === query.status)
  }

  if (query.search?.trim()) {
    result = result.filter((contact) => contactMatchesSearch(contact, query.search!))
  }

  return [...result].sort(compareContacts)
}

export async function fetchContacts(query: ContactsQuery = {}): Promise<ContactsPageResult> {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_CONTACT_PAGE_SIZE
  const from = (page - 1) * pageSize

  const [contactRows, companyDrivers] = await Promise.all([
    fetchContactRows(),
    fetchCompanyDrivers(),
  ])

  const directory = filterDirectoryContacts(
    buildDirectoryContacts(contactRows, companyDrivers),
    query,
  )

  return {
    items: directory.slice(from, from + pageSize),
    totalCount: directory.length,
    page,
    pageSize,
  }
}

function normalizeContactCategory(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function categoryMatches(normalized: string, aliases: string[]): boolean {
  return aliases.some(
    (alias) => normalized === alias || normalized.includes(alias),
  )
}

export async function fetchContactSummaryCounts(): Promise<ContactSummaryCounts> {
  try {
    const [contactRows, workersWithPhone] = await Promise.all([
      fetchContactRows(),
      fetchCompanyWorkersWithPhone(),
    ])

    let support = 0
    let service = 0
    let office = 0
    let insurance = 0

    for (const row of contactRows) {
      const category = normalizeContactCategory(row.category)
      if (categoryMatches(category, ['emergency', 'support', 'help'])) support += 1
      if (categoryMatches(category, ['garage_workshop', 'garage', 'workshop', 'service'])) {
        service += 1
      }
      if (categoryMatches(category, ['accountant', 'office'])) office += 1
      if (categoryMatches(category, ['insurance'])) insurance += 1
    }

    return {
      workerContacts: workersWithPhone.length,
      support,
      service,
      office,
      insurance,
    }
  } catch (error) {
    if (
      error instanceof ContactsServiceError &&
      isMissingContactsTableError(error.message)
    ) {
      return {
        workerContacts: 0,
        support: 0,
        service: 0,
        office: 0,
        insurance: 0,
      }
    }
    throw error
  }
}

/**
 * Count of company workers who have a saved phone number (source of truth: drivers.phone).
 */
export async function countWorkerPhoneContacts(): Promise<number> {
  const workers = await fetchCompanyWorkersWithPhone()
  return workers.length
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const payload = {
    company: resolveCompanyScope(),
    ...toDbPayload(input),
    category: input.category,
    status: input.status ?? 'active',
  }

  const { data, error } = await requireSupabase()
    .from('contacts')
    .insert(payload)
    .select(contactSelect)
    .single()

  logSupabaseQuery({
    service: 'contactsService.createContact',
    table: 'contacts',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingWorkerIdColumnError(error.message)) {
      throw new ContactsServiceError(
        'Contacts worker link is not available yet. Run the contacts worker_id migration on your Supabase project.',
      )
    }
    if (error.message.toLowerCase().includes('contacts_worker_id_unique')) {
      throw new ContactsServiceError('That worker is already linked to another contact.')
    }
    throw new ContactsServiceError(error.message)
  }

  return mapRow(data as unknown as ContactRow)
}

export async function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
  if (id.startsWith('worker:')) {
    throw new ContactsServiceError(
      'Worker phone contacts are managed on the Worker profile. Open the worker to edit details.',
    )
  }

  const payload = {
    ...toDbPayload(input),
    updated_at: new Date().toISOString(),
  }

  let request = requireSupabase().from('contacts').update(payload).eq('id', id)

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  const { data, error } = await request.select(contactSelect).single()

  logSupabaseQuery({
    service: 'contactsService.updateContact',
    table: 'contacts',
    data: data ? [data] : [],
    error,
  })

  if (error) {
    if (isMissingWorkerIdColumnError(error.message)) {
      throw new ContactsServiceError(
        'Contacts worker link is not available yet. Run the contacts worker_id migration on your Supabase project.',
      )
    }
    if (error.message.toLowerCase().includes('contacts_worker_id_unique')) {
      throw new ContactsServiceError('That worker is already linked to another contact.')
    }
    throw new ContactsServiceError(error.message)
  }

  return mapRow(data as unknown as ContactRow)
}

/** Clears contacts.worker_id only. Never deletes the Worker / drivers row. */
export async function unlinkContactWorker(id: string): Promise<Contact> {
  if (id.startsWith('worker:')) {
    throw new ContactsServiceError('This Worker contact is not a linked Contacts row.')
  }

  return updateContact(id, {
    workerId: null,
    category: 'other',
  })
}

/**
 * Deletes only the Contacts row. Never deletes drivers / Worker profile data.
 */
export async function deleteContact(id: string): Promise<void> {
  if (id.startsWith('worker:')) {
    throw new ContactsServiceError(
      'Worker phone contacts cannot be deleted from Contacts. Open the Worker profile instead.',
    )
  }

  let request = requireSupabase().from('contacts').delete().eq('id', id)

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  const { error } = await request

  logSupabaseQuery({
    service: 'contactsService.deleteContact',
    table: 'contacts',
    data: [],
    error,
  })

  if (error) {
    throw new ContactsServiceError(error.message)
  }
}

export const contactsService = {
  fetchContacts,
  fetchContactSummaryCounts,
  countWorkerPhoneContacts,
  createContact,
  updateContact,
  unlinkContactWorker,
  deleteContact,
}
