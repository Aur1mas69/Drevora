import type {
  Contact,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function buildSearchFilter(search: string): string {
  const term = search.trim().replace(/[%_,]/g, ' ')
  if (!term) return ''
  const pattern = `%${term}%`
  return [
    `name.ilike.${pattern}`,
    `organisation.ilike.${pattern}`,
    `phone.ilike.${pattern}`,
    `email.ilike.${pattern}`,
    `town_city.ilike.${pattern}`,
    `postcode.ilike.${pattern}`,
    `notes.ilike.${pattern}`,
  ].join(',')
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

  return payload
}

export async function fetchContacts(query: ContactsQuery = {}): Promise<ContactsPageResult> {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? DEFAULT_CONTACT_PAGE_SIZE
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let request = requireSupabase()
    .from('contacts')
    .select(contactSelect, { count: 'exact' })

  const company = resolveCompanyScope()
  if (company) {
    request = request.eq('company', company)
  }

  if (query.category && query.category !== 'all') {
    request = request.eq('category', query.category)
  }

  if (query.status && query.status !== 'all') {
    request = request.eq('status', query.status)
  }

  const searchFilter = query.search ? buildSearchFilter(query.search) : ''
  if (searchFilter) {
    request = request.or(searchFilter)
  }

  const { data, error, count } = await request
    .order('name', { ascending: true, nullsFirst: false })
    .order('organisation', { ascending: true, nullsFirst: false })
    .range(from, to)

  logSupabaseQuery({
    service: 'contactsService.fetchContacts',
    table: 'contacts',
    data,
    error,
    count,
  })

  if (error) {
    if (isMissingContactsTableError(error.message)) {
      throw new ContactsServiceError(
        'Contacts table is not available yet. Run the contacts migration on your Supabase project.',
      )
    }
    throw new ContactsServiceError(error.message)
  }

  const rows = (data ?? []) as unknown as ContactRow[]

  return {
    items: rows.map(mapRow),
    totalCount: count ?? rows.length,
    page,
    pageSize,
  }
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
    throw new ContactsServiceError(error.message)
  }

  return mapRow(data as unknown as ContactRow)
}

export async function updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
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
    throw new ContactsServiceError(error.message)
  }

  return mapRow(data as unknown as ContactRow)
}

export async function deleteContact(id: string): Promise<void> {
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
  createContact,
  updateContact,
  deleteContact,
}
