import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { ComplianceDocumentItem } from '@/lib/complianceTypes'
import { getDaysRemainingLabel, statusClassMap } from '@/lib/complianceUtils'
import {
  adminHeading,
  adminHeadingLg,
  adminTableDivide,
  adminTableHeadText,
  adminTableHeaderAlt,
  adminTableRowAlt,
  adminTableShell,
  adminText,
} from '@/lib/adminUiStyles'
import { Eye, Pencil, Trash2, Upload } from 'lucide-react'

type ComplianceDocumentsTableProps = {
  documents: ComplianceDocumentItem[]
  showEntity?: boolean
  onView?: (document: ComplianceDocumentItem) => void
  onEdit?: (document: ComplianceDocumentItem) => void
  onDelete?: (document: ComplianceDocumentItem) => void
  onUploadPlaceholder?: () => void
}

function DocumentRowActions({
  document,
  onView,
  onEdit,
  onDelete,
  onUploadPlaceholder,
}: {
  document: ComplianceDocumentItem
  onView?: (document: ComplianceDocumentItem) => void
  onEdit?: (document: ComplianceDocumentItem) => void
  onDelete?: (document: ComplianceDocumentItem) => void
  onUploadPlaceholder?: () => void
}) {
  const actions: RowAction[] = []

  if (onView) {
    actions.push({ id: 'view', label: 'View', icon: Eye, onClick: () => onView(document) })
  }

  if (document.canEdit && onEdit) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, onClick: () => onEdit(document) })
  }

  if (onUploadPlaceholder) {
    actions.push({
      id: 'upload',
      label: 'Upload Document',
      icon: Upload,
      onClick: onUploadPlaceholder,
    })
  }

  if (document.canDelete && onDelete) {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      onClick: () => onDelete(document),
    })
  }

  if (actions.length === 0) return null
  return <RowActionsMenu actions={actions} />
}

export function ComplianceDocumentsTable({
  documents,
  showEntity = false,
  onView,
  onEdit,
  onDelete,
  onUploadPlaceholder,
}: ComplianceDocumentsTableProps) {
  const { formatDate } = useCompanySettings()

  return (
    <div className={adminTableShell}>
      <div className="overflow-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className={adminTableHeaderAlt}>
            <tr className={adminTableHeadText}>
              {showEntity ? <th className="px-5 py-3.5">Worker / Vehicle</th> : null}
              <th className="px-5 py-3.5">Document Type</th>
              <th className="px-5 py-3.5">Document Name</th>
              <th className="px-5 py-3.5">Issue Date</th>
              <th className="px-5 py-3.5">Expiry Date</th>
              <th className="px-5 py-3.5">Days Remaining</th>
              <th className="px-5 py-3.5">Status</th>
              <TableActionsHeader className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className={adminTableDivide}>
            {documents.map((document) => (
              <tr key={document.id} className={adminTableRowAlt}>
                {showEntity ? (
                  <td className={`px-5 py-4 font-medium ${adminHeadingLg}`}>{document.entityName}</td>
                ) : null}
                <td className={`px-5 py-4 font-medium ${adminHeading}`}>{document.documentType}</td>
                <td className={`px-5 py-4 ${adminText}`}>{document.documentName ?? '—'}</td>
                <td className={`px-5 py-4 tabular-nums ${adminText}`}>
                  {document.issueDate ? formatDate(document.issueDate) : '—'}
                </td>
                <td className={`px-5 py-4 tabular-nums ${adminText}`}>
                  {document.expiryDate ? formatDate(document.expiryDate) : '—'}
                </td>
                <td className={`px-5 py-4 tabular-nums ${adminText}`}>
                  {getDaysRemainingLabel(document.daysRemaining)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${statusClassMap[document.status]}`}
                  >
                    {document.status}
                  </span>
                </td>
                <TableActionsCell className="px-5 py-4">
                  <DocumentRowActions
                    document={document}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onUploadPlaceholder={onUploadPlaceholder}
                  />
                </TableActionsCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
