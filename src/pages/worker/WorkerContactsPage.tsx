import { type Contact } from '@/lib/contactTypes'
import { getCategoryLabel } from '@/lib/contactUtils'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
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
  const isDark = useIsWorkerDarkMode()
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
    <div className="mx-auto box-border w-full min-w-0 max-w-md space-y-4 overflow-x-clip lg:max-w-2xl">
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
          className="min-h-[12rem] rounded-[1rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
          role="status"
          aria-label="Loading contacts"
        />
      ) : error ? (
        <div className="worker-list-card px-3 py-4">
          <p className="text-sm font-medium text-[color:var(--worker-text)]">
            Unable to load contacts
          </p>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">{error}</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-[1rem] border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-6 text-center">
          <p className="text-base font-semibold text-[color:var(--worker-text)]">
            No contacts have been shared with Workers yet.
          </p>
          <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
            Contact your office if you need an emergency or operational number.
          </p>
        </div>
      ) : (
        <ul className="worker-list-stack">
          {contacts.map((contact, index) => {
            const phone = contact.phone?.trim() || null
            const email = contact.email?.trim() || null
            const notes = contact.notes?.trim() || null
            const roleOrOrg =
              contact.roleTitle?.trim() || contact.organisation?.trim() || null

            return (
              <li key={contact.id} className={workerListCardClass(index, isDark)}>
                <div className="worker-list-card__meta">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'worker-accent-title truncate text-sm font-semibold',
                        !isDark && 'text-[color:var(--worker-text)]',
                      )}
                    >
                      {displayName(contact)}
                    </p>
                    {roleOrOrg ? (
                      <p
                        className={cn(
                          'worker-accent-secondary truncate text-xs',
                          !isDark && 'text-[color:var(--worker-text-secondary)]',
                        )}
                      >
                        {roleOrOrg}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'worker-accent-badge shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      !isDark &&
                        'bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]',
                    )}
                  >
                    {getCategoryLabel(contact.category)}
                  </span>
                </div>

                <div className="worker-list-card__actions">
                  {phone ? (
                    <a
                      href={telHref(phone)}
                      className={cn(
                        'worker-accent-link worker-list-card__tap text-sm font-medium transition-colors',
                        !isDark &&
                          'text-[color:var(--worker-link)] active:bg-[color:var(--worker-primary-soft)]',
                      )}
                    >
                      <span
                        className={cn(
                          'worker-accent-icon-well flex size-8 shrink-0 items-center justify-center rounded-full',
                          !isDark &&
                            'bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]',
                        )}
                      >
                        <Phone className="size-3.5" strokeWidth={1.85} aria-hidden />
                      </span>
                      <span className="min-w-0 break-all">{phone}</span>
                    </a>
                  ) : null}

                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className={cn(
                        'worker-accent-link worker-list-card__tap text-sm font-medium transition-colors',
                        !isDark &&
                          'text-[color:var(--worker-link)] active:bg-[color:var(--worker-primary-soft)]',
                      )}
                    >
                      <span
                        className={cn(
                          'worker-accent-icon-well flex size-8 shrink-0 items-center justify-center rounded-full',
                          !isDark &&
                            'bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]',
                        )}
                      >
                        <Mail className="size-3.5" strokeWidth={1.85} aria-hidden />
                      </span>
                      <span className="min-w-0 break-all">{email}</span>
                    </a>
                  ) : null}

                  {!phone && !email ? (
                    <p
                      className={cn(
                        'worker-accent-muted py-1 text-xs',
                        !isDark && 'text-[color:var(--worker-text-muted)]',
                      )}
                    >
                      No phone or email on this contact.
                    </p>
                  ) : null}
                </div>

                {notes ? (
                  <p
                    className={cn(
                      'worker-accent-divider worker-accent-secondary mt-2 border-t pt-2 text-xs leading-snug',
                      !isDark &&
                        'border-[color:var(--worker-border)] text-[color:var(--worker-text-secondary)]',
                    )}
                  >
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
