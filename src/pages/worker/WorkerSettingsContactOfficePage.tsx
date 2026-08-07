import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Contact } from '@/lib/contactTypes'
import { getCategoryLabel, getContactPrimaryName } from '@/lib/contactUtils'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { workerListCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import {
  ContactsServiceError,
  fetchWorkerVisibleContacts,
} from '@/services/contactsService'
import { Mail, Phone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function ContactActionCard({
  contact,
  index,
  isDark,
}: {
  contact: Contact
  index: number
  isDark: boolean
}) {
  const phone = contact.phone?.trim() || null
  const email = contact.email?.trim() || null
  const roleOrOrg =
    contact.roleTitle?.trim() || contact.organisation?.trim() || null

  return (
    <li className={workerListCardClass(index, isDark)}>
      <div className="min-w-0">
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
        {roleOrOrg ? (
          <p
            className={cn(
              'worker-accent-secondary mt-1 text-sm',
              !isDark && 'text-[color:var(--worker-text-secondary)]',
            )}
          >
            {roleOrOrg}
          </p>
        ) : null}
      </div>

      {phone || email ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {phone ? (
            <a
              href={telHref(phone)}
              className={cn(
                'worker-accent-pill inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
                !isDark &&
                  'border-[#89CFF0] bg-[#E8F3FE] text-[#0B68BE] hover:bg-[#DCEEFF]',
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
                'worker-accent-pill inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
                !isDark &&
                  'border-[color:var(--worker-border)] bg-[color:var(--worker-card)] text-[color:var(--worker-text)] hover:bg-[color:var(--worker-input)]',
              )}
            >
              <Mail className="size-4" aria-hidden />
              Email
            </a>
          ) : null}
        </div>
      ) : (
        <p
          className={cn(
            'worker-accent-muted mt-3 text-sm',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          No phone or email shared for this contact.
        </p>
      )}

      {phone ? (
        <p
          className={cn(
            'worker-accent-secondary mt-2 text-sm font-medium',
            !isDark && 'text-[color:var(--worker-text-secondary)]',
          )}
        >
          {phone}
        </p>
      ) : null}
      {email ? (
        <p
          className={cn(
            'worker-accent-secondary mt-0.5 break-all text-sm font-medium',
            !isDark && 'text-[color:var(--worker-text-secondary)]',
          )}
        >
          {email}
        </p>
      ) : null}
    </li>
  )
}

/**
 * Contact Office — employment and operational matters for the Worker’s company.
 * Separate from DREVORA technical support. Never invents phone/email.
 */
export default function WorkerSettingsContactOfficePage() {
  const isDark = useIsWorkerDarkMode()
  const { companyName } = useCompanySettings()
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

  const officeContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          Boolean(contact.phone?.trim() || contact.email?.trim()) &&
          contact.category !== 'worker',
      ),
    [contacts],
  )

  const companyLabel = companyName?.trim() || null

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-3">
        <WorkerSettingsBackLink to="/worker/settings/help" label="Help & Support" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
            Contact Office
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            For working hours, rota, holidays, assigned vehicles, company
            documents and operational issues. App bugs and technical problems
            belong in DREVORA Support.
          </p>
        </div>
      </header>

      {companyLabel ? (
        <div className="rounded-2xl border border-[#BFE3F5]/80 bg-[#F5FAFF] px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
            Company
          </p>
          <p className="mt-1 text-base font-semibold text-[color:var(--worker-text)]">
            {companyLabel}
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div
          className="min-h-[12rem] rounded-[1.5rem] bg-[color:var(--worker-card)]"
          role="status"
          aria-label="Loading office contacts"
        />
      ) : error ? (
        <div className="worker-card rounded-[1.5rem] px-4 py-5">
          <p className="text-sm font-semibold text-[color:var(--worker-text)]">
            Unable to load contacts
          </p>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">{error}</p>
        </div>
      ) : officeContacts.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-8 text-center">
          <p className="text-base font-semibold text-[color:var(--worker-text)]">
            No Office contact details have been configured.
          </p>
          <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
            Ask your Office to share a phone or email contact for Workers.
          </p>
        </div>
      ) : (
        <ul className="worker-list-stack">
          {officeContacts.map((contact, index) => (
            <ContactActionCard
              key={contact.id}
              contact={contact}
              index={index}
              isDark={isDark}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
