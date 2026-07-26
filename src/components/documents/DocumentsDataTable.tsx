import { Button } from '@/components/ui/button'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import {
  getDocumentArchiveReason,
  getDocumentArchiveReasonLabel,
  isDocumentInArchivedLifecycle,
  type Document,
  type DocumentsCentreTab,
} from '@/lib/documentTypes'
import {
  canEditDocumentRecord,
  canRestoreDocumentRecord,
  canReviewWorkerSubmission,
  documentStatusClassMap,
  getDocumentDisplayStatus,
  getDocumentFileCountLabel,
  getDocumentPrimaryName,
  getDocumentRelatedToLabel,
  getDocumentSecondaryType,
  getDocumentStatusLabel,
  getWorkerSubmissionReviewLabel,
  hasDocumentFile,
  isWorkerSubmissionDocument,
  workerSubmissionReviewClassMap,
} from '@/lib/documentUtils'
import { adminTableEntityName } from '@/lib/adminUiStyles'
import { Check, Eye, ExternalLink, Pencil, RotateCcw, Trash2, XCircle } from 'lucide-react'
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
  formatDateTime: (value: string) => string
  onView: (document: Document) => void
  onEdit: (document: Document) => void
  onDelete: (document: Document) => void
  onRestore: (document: Document) => void
  onOpenFile: (document: Document) => void
  onMarkReviewed: (document: Document) => void
  onReject: (document: Document) => void
}

function StatusBadge({ document }: { document: Document }) {
  const archiveReason = getDocumentArchiveReason(document)
  if (archiveReason) {
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap.archived}`}
      >
        {getDocumentArchiveReasonLabel(archiveReason)}
      </span>
    )
  }

  if (isWorkerSubmissionDocument(document) && document.reviewStatus) {
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${workerSubmissionReviewClassMap[document.reviewStatus]}`}
      >
        {getWorkerSubmissionReviewLabel(document.reviewStatus)}
      </span>
    )
  }

  const status = getDocumentDisplayStatus(document)
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${documentStatusClassMap[status]}`}
    >
      {getDocumentStatusLabel(status)}
    </span>
  )
}

function isPersistedDocumentsRow(document: Document): boolean {
  return !document.source || document.source === 'documents'
}

function DocumentDateCell({
  document,
  formatDate,
  formatDateTime,
}: {
  document: Document
  formatDate: (value: string) => string
  formatDateTime: (value: string) => string
}) {
  if (isWorkerSubmissionDocument(document) && document.submittedAt) {
    return (
      <div className="text-sm text-[#113C69]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5499BF]">
          Received
        </p>
        <p>{formatDateTime(document.submittedAt)}</p>
      </div>
    )
  }

  return (
    <div className="text-sm text-[#113C69]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5499BF]">
        Expires
      </p>
      <p>{document.expiryDate ? formatDate(document.expiryDate) : '—'}</p>
    </div>
  )
}

function DocumentActionsMenu({
  document,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onOpenFile,
  onMarkReviewed,
  onReject,
}: {
  document: Document
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onRestore: () => void
  onOpenFile: () => void
  onMarkReviewed: () => void
  onReject: () => void
}) {
  const inArchivedLifecycle = isDocumentInArchivedLifecycle(document)
  const actions: RowAction[] = []

  if (hasDocumentFile(document) && !isWorkerSubmissionDocument(document)) {
    actions.push({
      id: 'file',
      label: 'Open file',
      icon: ExternalLink,
      onClick: onOpenFile,
    })
  }

  actions.push({
    id: 'view',
    label: 'View',
    icon: Eye,
    onClick: onView,
  })

  if (canReviewWorkerSubmission(document)) {
    actions.push({
      id: 'reviewed',
      label: 'Mark as Reviewed',
      icon: Check,
      tone: 'success',
      onClick: onMarkReviewed,
    })
    actions.push({
      id: 'reject',
      label: 'Reject',
      icon: XCircle,
      tone: 'danger',
      onClick: onReject,
    })
  }

  if (inArchivedLifecycle) {
    if (canRestoreDocumentRecord(document)) {
      actions.push({
        id: 'restore',
        label: 'Restore',
        icon: RotateCcw,
        tone: 'success',
        onClick: onRestore,
      })
    }
    return <RowActionsMenu actions={actions} align="end" />
  }

  if (isPersistedDocumentsRow(document) && canEditDocumentRecord(document)) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit })
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    })
  }

  return <RowActionsMenu actions={actions} align="end" />
}

export function DocumentsDataTable({
  documents,
  tab: _tab,
  formatDate,
  formatDateTime,
  onView,
  onEdit,
  onDelete,
  onRestore,
  onOpenFile,
  onMarkReviewed,
  onReject,
}: DocumentsDataTableProps) {
  void _tab

  return (
    <>
      <div className={`hidden lg:block ${documentTableShellClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Related to</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Document</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Reference</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Date</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>Status</th>
                <th className={`${documentTableHeadClass} px-4 py-3`}>File</th>
                <TableActionsHeader className={`${documentTableHeadClass} px-2 py-3 text-center`} />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const secondaryType = getDocumentSecondaryType(document)
                return (
                  <tr key={document.id} className={documentTableRowClass}>
                    <td className="max-w-[180px] px-4 py-3">
                      <span className={`block truncate ${adminTableEntityName}`}>
                        {getDocumentRelatedToLabel(document)}
                      </span>
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className={`truncate ${adminTableEntityName}`}>
                        {getDocumentPrimaryName(document)}
                      </p>
                      {secondaryType ? (
                        <p className="mt-0.5 truncate text-xs text-[#5499BF]">{secondaryType}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#5499BF]">
                      {document.referenceNumber?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <DocumentDateCell
                        document={document}
                        formatDate={formatDate}
                        formatDateTime={formatDateTime}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge document={document} />
                    </td>
                    <td className="px-4 py-3">
                      {isWorkerSubmissionDocument(document) ? (
                        <button
                          type="button"
                          onClick={() => onView(document)}
                          className="text-sm font-semibold text-[#0B68BE] hover:underline"
                        >
                          {getDocumentFileCountLabel(document)}
                        </button>
                      ) : hasDocumentFile(document) ? (
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
                        onRestore={() => onRestore(document)}
                        onOpenFile={() => onOpenFile(document)}
                        onMarkReviewed={() => onMarkReviewed(document)}
                        onReject={() => onReject(document)}
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
        {documents.map((document) => {
          const secondaryType = getDocumentSecondaryType(document)
          return (
            <article key={document.id} className={documentMobileCardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate ${adminTableEntityName}`}>
                    {getDocumentPrimaryName(document)}
                  </p>
                  {secondaryType ? (
                    <p className="mt-0.5 text-xs text-[#5499BF]">{secondaryType}</p>
                  ) : null}
                  <p className={`mt-1 truncate ${adminTableEntityName}`}>
                    {getDocumentRelatedToLabel(document)}
                  </p>
                  <div className="mt-2">
                    <DocumentDateCell
                      document={document}
                      formatDate={formatDate}
                      formatDateTime={formatDateTime}
                    />
                  </div>
                  <div className="mt-2">
                    <StatusBadge document={document} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#0B68BE]">
                    {getDocumentFileCountLabel(document)}
                  </p>
                </div>
                <DocumentActionsMenu
                  document={document}
                  onView={() => onView(document)}
                  onEdit={() => onEdit(document)}
                  onDelete={() => onDelete(document)}
                  onRestore={() => onRestore(document)}
                  onOpenFile={() => onOpenFile(document)}
                  onMarkReviewed={() => onMarkReviewed(document)}
                  onReject={() => onReject(document)}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onView(document)}
                  className="h-9 rounded-[10px] border-[#C5DFFB] text-[#0B68BE]"
                >
                  View
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
