import { Button } from '@/components/ui/button'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { Contact } from '@/lib/contactTypes'
import {
  getWorkerProfileId,
  isWorkerDirectoryContact,
} from '@/lib/contactTypes'
import {
  formatContactLocation,
  getCategoryBadgeClass,
  getCategoryLabel,
  getContactPrimaryName,
  getContactSecondaryLine,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/contactUtils'
import { adminTableEntityName } from '@/lib/adminUiStyles'
import { Eye, Link2Off, Pencil, Trash2, UserRound } from 'lucide-react'
import {
  contactMobileCardClass,
  contactTableHeadClass,
  contactTableRowClass,
  contactTableShellClass,
} from './contactUiStyles'

type ContactsDataTableProps = {
  contacts: Contact[]
  onView: (contact: Contact) => void
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
  onUnlinkWorker: (contact: Contact) => void
  onViewWorker: (contact: Contact) => void
  onEditWorker: (contact: Contact) => void
}

function ContactActionsMenu({
  contact,
  onView,
  onEdit,
  onDelete,
  onUnlinkWorker,
  onViewWorker,
  onEditWorker,
}: {
  contact: Contact
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onUnlinkWorker: () => void
  onViewWorker: () => void
  onEditWorker: () => void
}) {
  const actions: RowAction[] = []

  if (isWorkerDirectoryContact(contact)) {
    actions.push(
      { id: 'view-worker', label: 'View Worker', icon: UserRound, onClick: onViewWorker },
      { id: 'edit-worker', label: 'Edit Worker', icon: Pencil, onClick: onEditWorker },
    )
    return <RowActionsMenu actions={actions} align="end" />
  }

  actions.push(
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit },
  )

  if (contact.workerId) {
    actions.push({
      id: 'unlink-worker',
      label: 'Unassign Worker',
      icon: Link2Off,
      onClick: onUnlinkWorker,
    })
  }

  actions.push({
    id: 'delete',
    label: 'Delete Contact',
    icon: Trash2,
    tone: 'danger',
    onClick: onDelete,
  })

  return <RowActionsMenu actions={actions} align="end" />
}

function CategoryBadge({ contact }: { contact: Contact }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getCategoryBadgeClass(contact.category)}`}
    >
      {getCategoryLabel(contact.category)}
    </span>
  )
}

function StatusBadge({ contact }: { contact: Contact }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getStatusBadgeClass(contact.status)}`}
    >
      {getStatusLabel(contact.status)}
    </span>
  )
}

export function ContactsDataTable({
  contacts,
  onView,
  onEdit,
  onDelete,
  onUnlinkWorker,
  onViewWorker,
  onEditWorker,
}: ContactsDataTableProps) {
  return (
    <>
      <div className={`hidden lg:block ${contactTableShellClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Contact</th>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Category</th>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Company / Organisation</th>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Phone</th>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Email</th>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Location</th>
                <th className={`${contactTableHeadClass} px-4 py-3`}>Status</th>
                <TableActionsHeader className={`${contactTableHeadClass} px-2 py-3 text-center`} />
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const secondary = getContactSecondaryLine(contact)
                const workerCode = contact.workerCode?.trim()
                return (
                  <tr key={contact.id} className={contactTableRowClass}>
                    <td className="px-4 py-3">
                      <p className={adminTableEntityName}>{getContactPrimaryName(contact)}</p>
                      {secondary ? (
                        <p className="mt-0.5 text-xs text-[#5499BF]">{secondary}</p>
                      ) : null}
                      {workerCode ? (
                        <p className="mt-0.5 text-xs font-medium text-[#5499BF]">ID {workerCode}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CategoryBadge contact={contact} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#113C69]">
                      {contact.organisation?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#113C69]">{contact.phone?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#113C69]">
                      {contact.email?.trim() ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-[#0B68BE] hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5499BF]">
                      {formatContactLocation(contact)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge contact={contact} />
                    </td>
                    <TableActionsCell>
                      <ContactActionsMenu
                        contact={contact}
                        onView={() => onView(contact)}
                        onEdit={() => onEdit(contact)}
                        onDelete={() => onDelete(contact)}
                        onUnlinkWorker={() => onUnlinkWorker(contact)}
                        onViewWorker={() => onViewWorker(contact)}
                        onEditWorker={() => onEditWorker(contact)}
                      />
                    </TableActionsCell>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {contacts.map((contact) => (
          <article key={contact.id} className={contactMobileCardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={adminTableEntityName}>{getContactPrimaryName(contact)}</p>
                {getContactSecondaryLine(contact) ? (
                  <p className="mt-0.5 text-xs text-[#5499BF]">
                    {getContactSecondaryLine(contact)}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <CategoryBadge contact={contact} />
                  <StatusBadge contact={contact} />
                </div>
              </div>
              <ContactActionsMenu
                contact={contact}
                onView={() => onView(contact)}
                onEdit={() => onEdit(contact)}
                onDelete={() => onDelete(contact)}
                onUnlinkWorker={() => onUnlinkWorker(contact)}
                onViewWorker={() => onViewWorker(contact)}
                onEditWorker={() => onEditWorker(contact)}
              />
            </div>

            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#5499BF]">Phone</dt>
                <dd className="font-medium text-[#113C69]">{contact.phone?.trim() || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#5499BF]">Email</dt>
                <dd className="truncate font-medium text-[#113C69]">
                  {contact.email?.trim() || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#5499BF]">Location</dt>
                <dd className="text-right font-medium text-[#113C69]">
                  {formatContactLocation(contact)}
                </dd>
              </div>
            </dl>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (isWorkerDirectoryContact(contact) && getWorkerProfileId(contact)) {
                  onViewWorker(contact)
                  return
                }
                onView(contact)
              }}
              className="mt-3 h-9 w-full rounded-[12px] text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
            >
              {isWorkerDirectoryContact(contact) ? 'View Worker' : 'View details'}
            </Button>
          </article>
        ))}
      </div>
    </>
  )
}
