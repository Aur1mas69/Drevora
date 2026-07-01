import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'
import { getResultBadgeClass, getStatusBadgeClass } from '@/lib/vehicleCheckUtils'
import {
  adminHeading,
  adminTableHeadText,
  adminTableHeader,
  adminTableRow,
  adminTableShellSm,
  adminText,
  adminTextStrong,
} from '@/lib/adminUiStyles'
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
    <div className={adminTableShellSm}>
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className={adminTableHeader}>
            <tr className={adminTableHeadText}>
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
              <tr key={check.id} className={`${adminTableRow} ${cellText}`}>
                <td className={`px-3 ${rowPadding} font-medium ${adminHeading}`}>
                  {check.vehicleRegistration}
                </td>
                <td className={`px-3 ${rowPadding} tabular-nums ${adminText}`}>
                  {check.fleetNumber ?? '—'}
                </td>
                <td className={`px-3 ${rowPadding} ${adminTextStrong}`}>{check.workerName}</td>
                <td className={`px-3 ${rowPadding} tabular-nums ${adminTextStrong}`}>
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
