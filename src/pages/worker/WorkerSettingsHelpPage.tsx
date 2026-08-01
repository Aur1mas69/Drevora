import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import type { Contact } from '@/lib/contactTypes'
import { getCategoryLabel, getContactPrimaryName } from '@/lib/contactUtils'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import {
  ContactsServiceError,
  fetchWorkerVisibleContacts,
} from '@/services/contactsService'
import { Mail, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function looksLikeSupport(contact: Contact): boolean {
  const haystack = [
    contact.name,
    contact.organisation,
    contact.roleTitle,
    contact.notes,
    contact.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    contact.category === 'emergency' ||
    contact.category === 'other' ||
    /\b(support|help|office|hr|manager|admin)\b/.test(haystack)
  )
}

/**
 * Help & Support — only shows configured Worker-visible contacts that look
 * like support/office help. Never invents phone/email.
 */
export default function WorkerSettingsHelpPage() {
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
              : 'Unable to load support contacts.',
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

  const supportContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          looksLikeSupport(contact) &&
          Boolean(contact.phone?.trim() || contact.email?.trim()),
      ),
    [contacts],
  )

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-3">
        <WorkerSettingsBackLink />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
            Help &amp; Support
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            Use support contacts shared by your office when available.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div
          className="min-h-[12rem] rounded-[1.5rem] bg-[color:var(--worker-card)]"
          role="status"
          aria-label="Loading support contacts"
        />
      ) : error ? (
        <div className="worker-card rounded-[1.5rem] px-4 py-5">
          <p className="text-sm font-semibold text-[color:var(--worker-text)]">
            Unable to load support contacts
          </p>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">{error}</p>
        </div>
      ) : supportContacts.length === 0 ? (
        <div className="space-y-3">
          <div className="rounded-[1.5rem] border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-8 text-center">
            <p className="text-base font-semibold text-[color:var(--worker-text)]">
              No support contact is configured
            </p>
            <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
              Ask your office for assistance, or check Contact Office if any numbers
              have been shared.
            </p>
          </div>
          <Link
            to="/worker/settings/contact-office"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 text-sm font-semibold text-[color:var(--worker-primary)] transition-colors hover:bg-[color:var(--worker-input)]"
          >
            Open Contact Office
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {supportContacts.map((contact, index) => {
            const phone = contact.phone?.trim() || null
            const email = contact.email?.trim() || null
            return (
              <li
                key={contact.id}
                className={workerAccentCardClass(
                  index,
                  isDark,
                  'rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-4 shadow-sm',
                )}
              >
                <p
                  className={cn(
                    'worker-accent-title text-base font-semibold',
                    !isDark && 'text-[color:var(--worker-text)]',
                  )}
                >
                  {getContactPrimaryName(contact)}
                </p>
                <p
                  className={cn(
                    'worker-accent-muted mt-0.5 text-xs font-medium uppercase tracking-[0.08em]',
                    !isDark && 'text-[color:var(--worker-text-muted)]',
                  )}
                >
                  {getCategoryLabel(contact.category)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {phone ? (
                    <a
                      href={telHref(phone)}
                      className={cn(
                        'worker-accent-pill inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold',
                        !isDark &&
                          'border-[#89CFF0] bg-[#E8F3FE] text-[#0B68BE]',
                      )}
                    >
                      <Phone className="size-4" aria-hidden />
                      Call
                    </a>
                  ) : null}
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className={cn(
                        'worker-accent-pill inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold',
                        !isDark &&
                          'border-[color:var(--worker-border)] text-[color:var(--worker-text)]',
                      )}
                    >
                      <Mail className="size-4" aria-hidden />
                      Email
                    </a>
                  ) : null}
                </div>
                {phone ? (
                  <p
                    className={cn(
                      'worker-accent-secondary mt-2 text-sm',
                      !isDark && 'text-[color:var(--worker-text-secondary)]',
                    )}
                  >
                    {phone}
                  </p>
                ) : null}
                {email ? (
                  <p
                    className={cn(
                      'worker-accent-secondary mt-0.5 break-all text-sm',
                      !isDark && 'text-[color:var(--worker-text-secondary)]',
                    )}
                  >
                    {email}
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
