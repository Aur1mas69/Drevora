import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { VehicleCheckListItem } from '@/lib/vehicleCheckTypes'
import { formatInspectionDuration } from '@/lib/vehicleCheckDurationUtils'
import {
  formatVehicleCheckResultLabel,
  getResultBadgeClass,
  getStatusBadgeClass,
} from '@/lib/vehicleCheckUtils'
import {
  adminHeading,
  adminTableHeader,
  adminTableRow,
  adminTableShell,
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
  const rowPadding = compactTables ? 'py-3' : 'py-4'
  const headerPadding = compactTables ? 'px-4 py-3' : 'px-4 py-3.5'
  const cellPadding = `px-4 ${rowPadding}`
  const badgeClassName =
    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:px-3 sm:py-1.5 sm:text-sm'

  function formatCheckDateTime(check: VehicleCheckListItem): string {
    const datePart = formatDate(check.inspectionDate)
    const timePart = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(check.createdAt))

    return `${datePart}, ${timePart}`
  }

  function getDefectsLabel(check: VehicleCheckListItem): string {
    if (check.defectCount === 0) return 'No defects'
    return `${check.defectCount} ${check.defectCount === 1 ? 'defect' : 'defects'}`
  }

  function getVehicleSubline(check: VehicleCheckListItem): string {
    const makeModel = [check.vehicleMake, check.vehicleModel].filter(Boolean).join(' ')
    if (makeModel && check.fleetNumber) return `${makeModel} · Fleet ${check.fleetNumber}`
    if (makeModel) return makeModel
    if (check.fleetNumber) return `Fleet ${check.fleetNumber}`
    return 'Vehicle details'
  }

  function getDurationLabel(check: VehicleCheckListItem): string {
    if (check.durationSeconds == null) return '—'
    return formatInspectionDuration(check.durationSeconds)
  }

  return (
    <div
      className={`${adminTableShell} shadow-[0_8px_24px_rgba(33,142,231,0.08)] ring-1 ring-[#D3E9FC]/80`}
    >
      <div className="max-h-[calc(100vh-22rem)] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className={adminTableHeader}>
            <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF] sm:text-sm sm:tracking-[0.06em]">
              <th className={headerPadding}>Date / Time</th>
              <th className={headerPadding}>Vehicle</th>
              <th className={headerPadding}>Worker</th>
              <th className={headerPadding}>Result</th>
              <th className={headerPadding}>Defects</th>
              <th className={headerPadding}>Duration</th>
              <th className={headerPadding}>Status</th>
              <TableActionsHeader className={headerPadding} />
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr
                key={check.id}
                className={`${adminTableRow} min-h-[68px] text-sm sm:min-h-[72px]`}
              >
                <td className={`${cellPadding} align-middle tabular-nums font-medium ${adminTextStrong}`}>
                  {formatCheckDateTime(check)}
                </td>
                <td className={`${cellPadding} align-middle`}>
                  <div className={`text-sm font-semibold sm:text-base ${adminHeading}`}>
                    {check.vehicleRegistration}
                  </div>
                  <div className={`mt-1 text-xs leading-5 sm:text-sm ${adminText}`}>
                    {getVehicleSubline(check)}
                  </div>
                </td>
                <td className={`${cellPadding} align-middle font-medium ${adminTextStrong}`}>
                  {check.workerName}
                </td>
                <td className={`${cellPadding} align-middle`}>
                  <span
                    className={`${badgeClassName} ${getResultBadgeClass(check.overallResult)}`}
                  >
                    {formatVehicleCheckResultLabel(check.overallResult)}
                  </span>
                </td>
                <td
                  className={`${cellPadding} align-middle font-medium ${
                    check.defectCount > 0 ? 'font-semibold text-amber-700' : adminText
                  }`}
                >
                  {getDefectsLabel(check)}
                </td>
                <td className={`${cellPadding} align-middle tabular-nums font-medium ${adminTextStrong}`}>
                  {getDurationLabel(check)}
                </td>
                <td className={`${cellPadding} align-middle`}>
                  <span className={`${badgeClassName} ${getStatusBadgeClass(check.status)}`}>
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
