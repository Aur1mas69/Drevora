import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { ComplianceDocumentItem } from '@/lib/complianceTypes'
import { getDaysRemainingLabel } from '@/lib/complianceUtils'

type ComplianceExpiryTableProps = {
  documents: ComplianceDocumentItem[]
}

export function ComplianceExpiryTable({ documents }: ComplianceExpiryTableProps) {
  const { formatDate } = useCompanySettings()

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#F8FBFF] shadow-[0_1px_0_rgba(75,120,220,0.10)]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <th className="px-5 py-3.5">Worker / Vehicle</th>
              <th className="px-5 py-3.5">Document</th>
              <th className="px-5 py-3.5">Expiry</th>
              <th className="px-5 py-3.5">Days Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {documents.map((document) => (
              <tr key={document.id} className="text-sm transition-colors hover:bg-[#F8FBFF]">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{document.entityName}</p>
                  <p className="mt-0.5 text-xs capitalize text-slate-500">{document.entityType}</p>
                </td>
                <td className="px-5 py-4 font-medium text-[#2A376F]">{document.documentType}</td>
                <td className="px-5 py-4 tabular-nums text-slate-600">
                  {document.expiryDate ? formatDate(document.expiryDate) : '—'}
                </td>
                <td className="px-5 py-4 tabular-nums text-slate-600">
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
