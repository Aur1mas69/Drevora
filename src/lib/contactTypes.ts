export type ContactCategory =
  | 'customer'
  | 'supplier'
  | 'garage_workshop'
  | 'site_plant'
  | 'insurance'
  | 'accountant'
  | 'emergency'
  | 'other'

export type ContactStatus = 'active' | 'inactive'

export type ContactCategoryFilter = ContactCategory | 'all'
export type ContactStatusFilter = ContactStatus | 'all'

export type Contact = {
  id: string
  company: string | null
  name: string | null
  organisation: string | null
  category: ContactCategory
  phone: string | null
  email: string | null
  website: string | null
  roleTitle: string | null
  vatNumber: string | null
  accountReference: string | null
  addressLine1: string | null
  addressLine2: string | null
  townCity: string | null
  county: string | null
  postcode: string | null
  country: string | null
  notes: string | null
  status: ContactStatus
  createdAt: string
  updatedAt: string
}

export type ContactsQuery = {
  search?: string
  category?: ContactCategoryFilter
  status?: ContactStatusFilter
  page?: number
  pageSize?: number
}

export type ContactsPageResult = {
  items: Contact[]
  totalCount: number
  page: number
  pageSize: number
}

export type CreateContactInput = {
  name?: string | null
  organisation?: string | null
  category: ContactCategory
  phone?: string | null
  email?: string | null
  website?: string | null
  roleTitle?: string | null
  vatNumber?: string | null
  accountReference?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  townCity?: string | null
  county?: string | null
  postcode?: string | null
  country?: string | null
  notes?: string | null
  status?: ContactStatus
}

export type UpdateContactInput = Partial<CreateContactInput>

export type ContactFormValues = {
  name: string
  organisation: string
  category: ContactCategory
  phone: string
  email: string
  website: string
  roleTitle: string
  vatNumber: string
  accountReference: string
  addressLine1: string
  addressLine2: string
  townCity: string
  county: string
  postcode: string
  country: string
  notes: string
  status: ContactStatus
}

export const CONTACT_CATEGORIES: { value: ContactCategory; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'garage_workshop', label: 'Garage / Workshop' },
  { value: 'site_plant', label: 'Site / Plant' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
]

export const DEFAULT_CONTACT_PAGE_SIZE = 25

export const CONTACT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
