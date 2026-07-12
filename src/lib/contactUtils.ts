import type {
  Contact,
  ContactCategory,
  ContactFormValues,
  ContactStatus,
} from '@/lib/contactTypes'
import { CONTACT_CATEGORIES } from '@/lib/contactTypes'

export function isContactCategory(value: string): value is ContactCategory {
  return CONTACT_CATEGORIES.some((item) => item.value === value)
}

export function isContactStatus(value: string): value is ContactStatus {
  return value === 'active' || value === 'inactive'
}

export function getCategoryLabel(category: ContactCategory): string {
  return CONTACT_CATEGORIES.find((item) => item.value === category)?.label ?? 'Other'
}

export function getCategoryBadgeClass(category: ContactCategory): string {
  switch (category) {
    case 'customer':
      return 'bg-[#E8F3FE] text-[#0B68BE] ring-[#BFE3F5]'
    case 'supplier':
      return 'bg-violet-50 text-violet-700 ring-violet-100'
    case 'garage_workshop':
      return 'bg-amber-50 text-amber-800 ring-amber-100'
    case 'site_plant':
      return 'bg-teal-50 text-teal-700 ring-teal-100'
    case 'insurance':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-100'
    case 'accountant':
      return 'bg-sky-50 text-sky-700 ring-sky-100'
    case 'emergency':
      return 'bg-rose-50 text-rose-700 ring-rose-100'
    case 'worker':
      return 'bg-[#E8F3FE] text-[#0B68BE] ring-[#89CFF0]'
    case 'other':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200'
  }
}

export function getStatusLabel(status: ContactStatus): string {
  return status === 'active' ? 'Active' : 'Inactive'
}

export function getStatusBadgeClass(status: ContactStatus): string {
  return status === 'active'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
    : 'bg-slate-100 text-slate-600 ring-slate-200'
}

export function getContactPrimaryName(contact: Pick<Contact, 'name' | 'organisation'>): string {
  const name = contact.name?.trim() ?? ''
  const organisation = contact.organisation?.trim() ?? ''
  if (name) return name
  if (organisation) return organisation
  return 'Unnamed contact'
}

export function getContactSecondaryLine(
  contact: Pick<Contact, 'name' | 'organisation'>,
): string | null {
  const name = contact.name?.trim() ?? ''
  const organisation = contact.organisation?.trim() ?? ''
  if (name && organisation && name !== organisation) return organisation
  return null
}

export function formatContactLocation(
  contact: Pick<Contact, 'townCity' | 'county' | 'postcode' | 'country'>,
): string {
  const parts = [
    contact.townCity?.trim(),
    contact.county?.trim(),
    contact.postcode?.trim(),
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(', ')
  return contact.country?.trim() || '—'
}

export function formatContactAddress(contact: Contact): string {
  const lines = [
    contact.addressLine1?.trim(),
    contact.addressLine2?.trim(),
    [contact.townCity?.trim(), contact.county?.trim()].filter(Boolean).join(', '),
    contact.postcode?.trim(),
    contact.country?.trim(),
  ].filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : '—'
}

export function buildEmptyContactFormValues(): ContactFormValues {
  return {
    name: '',
    organisation: '',
    category: 'customer',
    phone: '',
    email: '',
    website: '',
    roleTitle: '',
    vatNumber: '',
    accountReference: '',
    addressLine1: '',
    addressLine2: '',
    townCity: '',
    county: '',
    postcode: '',
    country: 'United Kingdom',
    notes: '',
    status: 'active',
    workerId: '',
  }
}

export function contactToFormValues(contact: Contact): ContactFormValues {
  return {
    name: contact.name ?? '',
    organisation: contact.organisation ?? '',
    category: contact.category,
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    website: contact.website ?? '',
    roleTitle: contact.roleTitle ?? '',
    vatNumber: contact.vatNumber ?? '',
    accountReference: contact.accountReference ?? '',
    addressLine1: contact.addressLine1 ?? '',
    addressLine2: contact.addressLine2 ?? '',
    townCity: contact.townCity ?? '',
    county: contact.county ?? '',
    postcode: contact.postcode ?? '',
    country: contact.country ?? 'United Kingdom',
    notes: contact.notes ?? '',
    status: contact.status,
    workerId: contact.workerId ?? '',
  }
}

export function validateContactForm(values: ContactFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = values.name.trim()
  const organisation = values.organisation.trim()

  if (!name && !organisation) {
    errors.name = 'Enter a contact name or company / organisation.'
    errors.organisation = 'Enter a contact name or company / organisation.'
  }

  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  return errors
}

export function contactFormValuesToInput(values: ContactFormValues) {
  return {
    name: values.name.trim() || null,
    organisation: values.organisation.trim() || null,
    category: values.category,
    phone: values.phone.trim() || null,
    email: values.email.trim() || null,
    website: values.website.trim() || null,
    roleTitle: values.roleTitle.trim() || null,
    vatNumber: values.vatNumber.trim() || null,
    accountReference: values.accountReference.trim() || null,
    addressLine1: values.addressLine1.trim() || null,
    addressLine2: values.addressLine2.trim() || null,
    townCity: values.townCity.trim() || null,
    county: values.county.trim() || null,
    postcode: values.postcode.trim() || null,
    country: values.country.trim() || 'United Kingdom',
    notes: values.notes.trim() || null,
    status: values.status,
    workerId: values.workerId.trim() || null,
  }
}
