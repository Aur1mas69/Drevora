import { Button } from '@/components/ui/button'
import { useBodyScrollLock } from '@/components/holidays/useBodyScrollLock'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { Contact } from '@/lib/contactTypes'
import { getWorkerProfileId, isWorkerDirectoryContact } from '@/lib/contactTypes'
import {
  formatContactAddress,
  getCategoryBadgeClass,
  getCategoryLabel,
  getContactPrimaryName,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/contactUtils'
import { Link2Off, Pencil, UserRound, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type ContactDrawerProps = {
  contact: Contact | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (contact: Contact) => void
  onUnlinkWorker?: (contact: Contact) => void
  onViewWorker?: (contact: Contact) => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="min-w-[120px] text-xs font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
        {label}
      </dt>
      <dd className="whitespace-pre-line text-sm font-medium text-[#113C69] dark:text-slate-100">{value}</dd>
    </div>
  )
}

export function ContactDrawer({
  contact,
  isOpen,
  onClose,
  onEdit,
  onUnlinkWorker,
  onViewWorker,
}: ContactDrawerProps) {
  const { formatDateTime } = useCompanySettings()
  useBodyScrollLock(isOpen)

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !contact || typeof document === 'undefined') return null

  const isWorkerRow = isWorkerDirectoryContact(contact)
  const workerId = getWorkerProfileId(contact)

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/35 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close contact details"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[#D3E9FC] bg-white shadow-[-20px_0_60px_rgba(11,38,70,0.12)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40">
        <div className="flex items-start justify-between border-b border-[#D3E9FC]/70 px-5 py-4">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#218EE7]">
              {isWorkerRow ? 'Worker contact' : 'Contact details'}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#113C69] dark:text-slate-100">
              {getContactPrimaryName(contact)}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getCategoryBadgeClass(contact.category)}`}
              >
                {getCategoryLabel(contact.category)}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getStatusBadgeClass(contact.status)}`}
              >
                {getStatusLabel(contact.status)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 rounded-[10px] p-0 text-slate-500"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <dl className="space-y-3 rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] p-4">
            {contact.workerCode ? (
              <DetailRow label="Worker ID" value={contact.workerCode} />
            ) : null}
            <DetailRow label="Company" value={contact.organisation?.trim() || '—'} />
            <DetailRow label="Phone" value={contact.phone?.trim() || '—'} />
            <DetailRow label="Email" value={contact.email?.trim() || '—'} />
            <DetailRow label="Website" value={contact.website?.trim() || '—'} />
            <DetailRow label="Role" value={contact.roleTitle?.trim() || '—'} />
            <DetailRow label="VAT number" value={contact.vatNumber?.trim() || '—'} />
            <DetailRow
              label="Account ref"
              value={contact.accountReference?.trim() || '—'}
            />
            <DetailRow label="Address" value={formatContactAddress(contact)} />
            <DetailRow label="Notes" value={contact.notes?.trim() || '—'} />
            {contact.createdAt ? (
              <DetailRow label="Created" value={formatDateTime(contact.createdAt)} />
            ) : null}
          </dl>
        </div>

        <div className="space-y-2 border-t border-[#D3E9FC]/70 px-5 py-4">
          {isWorkerRow && workerId && onViewWorker ? (
            <Button
              type="button"
              onClick={() => onViewWorker(contact)}
              className="h-10 w-full rounded-[12px] bg-[#218EE7] text-sm font-semibold text-white hover:bg-[#0B68BE]"
            >
              <UserRound className="mr-1.5 size-4" />
              View Worker
            </Button>
          ) : null}

          {!isWorkerRow && onEdit ? (
            <Button
              type="button"
              onClick={() => onEdit(contact)}
              className="h-10 w-full rounded-[12px] bg-[#218EE7] text-sm font-semibold text-white hover:bg-[#0B68BE]"
            >
              <Pencil className="mr-1.5 size-4" />
              Edit contact
            </Button>
          ) : null}

          {!isWorkerRow && contact.workerId && onUnlinkWorker ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onUnlinkWorker(contact)}
              className="h-10 w-full rounded-[12px] border-[#C5DFFB] text-sm font-semibold text-[#0B68BE]"
            >
              <Link2Off className="mr-1.5 size-4" />
              Unassign Worker
            </Button>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
