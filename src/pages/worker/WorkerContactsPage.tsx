import { type Contact } from '@/lib/contactTypes'
import { getCategoryLabel } from '@/lib/contactUtils'
import {
  ContactsServiceError,
  fetchWorkerVisibleContacts,
} from '@/services/contactsService'
import { Mail, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'

function displayName(contact: Contact): string {
  return contact.name?.trim() || contact.organisation?.trim() || 'Unnamed contact'
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export default function WorkerContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const rows = await fetchWorkerVisibleContacts()
        if (!cancelled) setContacts(rows)
      } catch (loadError) {
        if (cancelled) return
        setContacts([])
        setError(
          loadError instanceof ContactsServiceError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : 'Unable to load contacts.',
        )
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto box-border w-full min-w-0 max-w-md space-y-5 overflow-x-clip lg:max-w-2xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Contacts
        </h1>
        <p className="text-sm text-[color:var(--worker-text-secondary)]">
          Emergency and operational numbers shared by your office.
        </p>
      </header>

      {isLoading ? (
        <div
          className="min-h-[12rem] rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
          role="status"
          aria-label="Loading contacts"
        />
      ) : error ? (
        <div className="rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-5">
          <p className="text-sm font-medium text-[color:var(--worker-text)]">
            Unable to load contacts
          </p>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">{error}</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-8 text-center">
          <p className="text-base font-semibold text-[color:var(--worker-text)]">
            No contacts have been shared with Workers yet.
          </p>
          <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
            Contact your office if you need an emergency or operational number.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {contacts.map((contact) => {
            const phone = contact.phone?.trim() || null
            const email = contact.email?.trim() || null
            const notes = contact.notes?.trim() || null
            const roleOrOrg =
              contact.roleTitle?.trim() || contact.organisation?.trim() || null

            return (
              <li
                key={contact.id}
                className="rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[color:var(--worker-text)]">
                      {displayName(contact)}
                    </p>
                    {roleOrOrg ? (
                      <p className="mt-0.5 truncate text-sm text-[color:var(--worker-text-secondary)]">
                        {roleOrOrg}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[color:var(--worker-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--worker-primary)]">
                    {getCategoryLabel(contact.category)}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {phone ? (
                    <a
                      href={telHref(phone)}
                      className="flex items-center gap-2.5 rounded-xl px-1 py-1 text-sm font-medium text-[color:var(--worker-link)] transition-colors active:bg-[color:var(--worker-primary-soft)]"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]">
                        <Phone className="size-4" strokeWidth={1.85} aria-hidden />
                      </span>
                      <span className="min-w-0 break-all">{phone}</span>
                    </a>
                  ) : null}

                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className="flex items-center gap-2.5 rounded-xl px-1 py-1 text-sm font-medium text-[color:var(--worker-link)] transition-colors active:bg-[color:var(--worker-primary-soft)]"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]">
                        <Mail className="size-4" strokeWidth={1.85} aria-hidden />
                      </span>
                      <span className="min-w-0 break-all">{email}</span>
                    </a>
                  ) : null}

                  {!phone && !email ? (
                    <p className="text-sm text-[color:var(--worker-text-muted)]">
                      No phone or email on this contact.
                    </p>
                  ) : null}
                </div>

                {notes ? (
                  <p className="mt-3 border-t border-[color:var(--worker-border)] pt-3 text-sm leading-relaxed text-[color:var(--worker-text-secondary)]">
                    {notes}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
