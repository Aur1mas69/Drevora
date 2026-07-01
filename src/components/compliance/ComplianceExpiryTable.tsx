import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { ComplianceDocumentItem } from '@/lib/complianceTypes'
import { getDaysRemainingLabel } from '@/lib/complianceUtils'
import {
  adminHeading,
  adminTableDivide,
  adminTableHeadText,
  adminTableHeaderAlt,
  adminTableRowAlt,
  adminTableShell,
  adminText,
  adminTextMuted,
  adminHeadingLg,
} from '@/lib/adminUiStyles'

type ComplianceExpiryTableProps = {
  documents: ComplianceDocumentItem[]
}

export function ComplianceExpiryTable({ documents }: ComplianceExpiryTableProps) {
  const { formatDate } = useCompanySettings()

  return (
    <div className={adminTableShell}>
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className={adminTableHeaderAlt}>
            <tr className={adminTableHeadText}>
              <th className="px-5 py-3.5">Worker / Vehicle</th>
              <th className="px-5 py-3.5">Document</th>
              <th className="px-5 py-3.5">Expiry</th>
              <th className="px-5 py-3.5">Days Remaining</th>
            </tr>
          </thead>
          <tbody className={adminTableDivide}>
            {documents.map((document) => (
              <tr key={document.id} className={adminTableRowAlt}>
                <td className="px-5 py-4">
                  <p className={`font-semibold ${adminHeadingLg}`}>{document.entityName}</p>
                  <p className={`mt-0.5 text-xs capitalize ${adminTextMuted}`}>{document.entityType}</p>
                </td>
                <td className={`px-5 py-4 font-medium ${adminHeading}`}>{document.documentType}</td>
                <td className={`px-5 py-4 tabular-nums ${adminText}`}>
                  {document.expiryDate ? formatDate(document.expiryDate) : '—'}
                </td>
                <td className={`px-5 py-4 tabular-nums ${adminText}`}>
                  {getDaysRemainingLabel(document.daysRemaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
