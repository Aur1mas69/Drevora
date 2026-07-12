import { Button } from '@/components/ui/button'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { Document, DocumentsCentreTab } from '@/lib/documentTypes'
import {
  documentStatusClassMap,
  getDocumentStatusLabel,
  getDocumentViewTarget,
  hasDocumentFile,
} from '@/lib/documentUtils'
import { adminTableEntityName } from '@/lib/adminUiStyles'
import { Eye, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import {
  documentMobileCardClass,
  documentTableHeadClass,
  documentTableRowClass,
  documentTableShellClass,
} from './documentUiStyles'

type DocumentsDataTableProps = {
  documents: Document[]
  tab: DocumentsCentreTab
  formatDate: (value: string) => string
  onView: (document: Document) => void
  onEdit: (document: Document) => void
  onDelete: (document: Document) => void
  onOpenFile: (document: Document) => void
}

function StatusBadge({ document }: { document: Document }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap[document.status]}`}
    >
      {getDocumentStatusLabel(document.status)}
    </span>
  )
}

function DocumentActionsMenu({
  document,
  onView,
  onEdit,
  onDelete,
  onOpenFile,
}: {
  document: Document
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenFile: () => void
}) {
  const viewTarget = getDocumentViewTarget(document)
  const actions: RowAction[] = [
    {
      id: 'view',
      label: viewTarget.kind === 'none' ? 'No file uploaded' : 'View',
      icon: Eye,
      onClick: onView,
    },
  ]

  if (document.source !== 'legacy_worker' && document.source !== 'worker_compliance') {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit })
  }

  if (document.source !== 'legacy_worker') {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    })
  }

  if (hasDocumentFile(document)) {
    actions.unshift({
      id: 'file',
      label: 'Open file',
      icon: ExternalLink,
      onClick: onOpenFile,
    })
  }

  return <RowActionsMenu actions={actions} align="end" />
}

export function DocumentsDataTable({
  documents,
  tab,
  formatDate,
  onView,
  onEdit,
  onDelete,
  onOpenFile,
}: DocumentsDataTableProps) {
  const showWorker = tab === 'workers' || tab === 'expiring-soon' || tab === 'expired' || tab === 'all'
  const showVehicle = tab === 'vehicles' || tab === 'expiring-soon' || tab === 'expired' || tab === 'all'
  const showScopeColumn = tab === 'expiring-soon' || tab === 'expired' || tab === 'all'

  return (
    <>
      <div className={`hidden lg:block ${documentTableShellClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                {showWorker ? (
                  <th className={`${documentTableHeadClass} px-4 py-3`}>Worker</th>
                ) : null}
                {showVehicle ? (
                  <th className={`${documentTableHeadClass} px-4 py-3`}>Vehicle</th>
                ) : null}
                {showScopeColumn ? (
                  <th className={`${documentTableHeadClass} px-4 py-3`}>Applies to</th>
                ) : null}
                <th className={`${documentTableHeadClass} px-4 py-3`}>Document</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Type</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Reference</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Expiry Date</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Status</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>File</th>
                <TableActionsHeader className={`${documentTableHeadClass} px-2 py-3 text-center`} />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className={documentTableRowClass}>
                  {showWorker ? (
                    <td className="max-w-[180px] px-4 py-3">
                      <span className={`block truncate ${adminTableEntityName}`}>
                        {document.appliesTo === 'worker' ? document.workerName ?? '—' : '—'}
                      </span>
                    </td>
                  ) : null}
                  {showVehicle ? (
                    <td className="px-4 py-3 text-sm font-medium text-[#113C69]">
                      {document.appliesTo === 'vehicle' ? document.vehicleLabel ?? '—' : '—'}
                    </td>
                  ) : null}
                  {showScopeColumn ? (
                    <td className="px-4 py-3 text-sm capitalize text-[#5499BF]">
                      {document.appliesTo}
                    </td>
                  ) : null}
                  <td className="max-w-[240px] px-4 py-3">
                    <p className={`truncate ${adminTableEntityName}`}>{document.documentName}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#113C69]">{document.documentType}</td>
                  <td className="px-4 py-3 text-sm text-[#5499BF]">
                    {document.referenceNumber?.trim() || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#113C69]">
                    {document.expiryDate ? formatDate(document.expiryDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge document={document} />
                  </td>
                  <td className="px-4 py-3">
                    {hasDocumentFile(document) ? (
                      <button
                        type="button"
                        onClick={() => onOpenFile(document)}
                        className="text-sm font-semibold text-[#0B68BE] hover:underline"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-sm text-[#5499BF]">No file uploaded</span>
                    )}
                  </td>
                  <TableActionsCell>
                    <DocumentActionsMenu
                      document={document}
                      onView={() => onView(document)}
                      onEdit={() => onEdit(document)}
                      onDelete={() => onDelete(document)}
                      onOpenFile={() => onOpenFile(document)}
                    />
                  </TableActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {documents.map((document) => (
          <article key={document.id} className={documentMobileCardClass}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`truncate ${adminTableEntityName}`}>{document.documentName}</p>
                <p className="mt-0.5 text-xs text-[#5499BF]">{document.documentType}</p>
                {document.workerName ? (
                  <p className={`mt-1 truncate ${adminTableEntityName}`}>{document.workerName}</p>
                ) : null}
                {document.vehicleLabel ? (
                  <p className="mt-1 text-xs font-medium text-[#113C69]">{document.vehicleLabel}</p>
                ) : null}
                <div className="mt-2">
                  <StatusBadge document={document} />
                </div>
              </div>
              <DocumentActionsMenu
                document={document}
                onView={() => onView(document)}
                onEdit={() => onEdit(document)}
                onDelete={() => onDelete(document)}
                onOpenFile={() => onOpenFile(document)}
              />
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#5499BF]">Expiry</dt>
                <dd className="font-medium text-[#113C69]">
                  {document.expiryDate ? formatDate(document.expiryDate) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#5499BF]">Reference</dt>
                <dd className="font-medium text-[#113C69]">
                  {document.referenceNumber?.trim() || '—'}
                </dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onView(document)}
              className="mt-3 h-9 w-full rounded-[12px] text-sm font-semibold text-[#0B68BE] hover:bg-[#EEF6FF]"
            >
              View details
            </Button>
          </article>
        ))}
      </div>
    </>
  )
}
