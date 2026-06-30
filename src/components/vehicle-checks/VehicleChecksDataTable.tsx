import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'
import { getResultBadgeClass, getStatusBadgeClass } from '@/lib/vehicleCheckUtils'
import { Eye, Pencil, Trash2 } from 'lucide-react'

type VehicleChecksDataTableProps = {
  checks: VehicleCheckListItem[]
  onView: (check: VehicleCheckListItem) => void
  onEdit: (check: VehicleCheckListItem) => void
  onDelete: (check: VehicleCheckListItem) => void
}

function VehicleCheckRowActions({
  onView,
  onEdit,
  onDelete,
}: {
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit },
    { id: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onClick: onDelete },
  ]

  return <RowActionsMenu actions={actions} />
}

export function VehicleChecksDataTable({
  checks,
  onView,
  onEdit,
  onDelete,
}: VehicleChecksDataTableProps) {
  const { formatDate, compactTables } = useCompanySettings()
  const rowPadding = compactTables ? 'py-1' : 'py-1.5'
  const cellText = compactTables ? 'text-[11px]' : 'text-xs'

  return (
    <div className="overflow-hidden rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#F4F8FF] shadow-[0_1px_0_rgba(75,120,220,0.10)]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Fleet No</th>
              <th className="px-3 py-2">Driver</th>
              <th className="px-3 py-2">Inspection Date</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Status</th>
              <TableActionsHeader />
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr
                key={check.id}
                className={`border-t border-[rgba(75,120,220,0.06)] ${cellText} transition-colors hover:bg-[#F8FBFF]/70`}
              >
                <td className={`px-3 ${rowPadding} font-medium text-[#2A376F]`}>
                  {check.vehicleRegistration}
                </td>
                <td className={`px-3 ${rowPadding} tabular-nums text-slate-600`}>
                  {check.fleetNumber ?? '—'}
                </td>
                <td className={`px-3 ${rowPadding} text-slate-700`}>{check.workerName}</td>
                <td className={`px-3 ${rowPadding} tabular-nums text-slate-700`}>
                  {formatDate(check.inspectionDate)}
                </td>
                <td className={`px-3 ${rowPadding}`}>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getResultBadgeClass(check.overallResult)}`}
                  >
                    {check.overallResult}
                  </span>
                </td>
                <td className={`px-3 ${rowPadding}`}>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(check.status)}`}
                  >
                    {check.status}
                  </span>
                </td>
                <TableActionsCell className={rowPadding}>
                  <VehicleCheckRowActions
                    onView={() => onView(check)}
                    onEdit={() => onEdit(check)}
                    onDelete={() => onDelete(check)}
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
