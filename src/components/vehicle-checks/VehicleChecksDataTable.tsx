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
  formatDefectReviewStatusLabel,
  formatVehicleCheckResultLabel,
  getDefectReviewBadgeClass,
  getResultBadgeClass,
} from '@/lib/vehicleCheckUtils'
import {
  adminTableEntityName,
  adminTableHeader,
  adminTableRow,
  adminTableShell,
  adminText,
  adminTextStrong,
} from '@/lib/adminUiStyles'
import { ClipboardCheck, Eye, Pencil, Trash2 } from 'lucide-react'

type VehicleChecksDataTableProps = {
  checks: VehicleCheckListItem[]
  onView: (check: VehicleCheckListItem) => void
  onEdit: (check: VehicleCheckListItem) => void
  onDelete: (check: VehicleCheckListItem) => void
  onReviewDefects: (check: VehicleCheckListItem) => void
}

function VehicleCheckRowActions({
  canReview,
  onView,
  onEdit,
  onDelete,
  onReviewDefects,
}: {
  canReview: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onReviewDefects: () => void
}) {
  const actions: RowAction[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
  ]

  if (canReview) {
    actions.push({
      id: 'review',
      label: 'Review defects',
      icon: ClipboardCheck,
      onClick: onReviewDefects,
    })
  }

  actions.push(
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit },
    { id: 'delete', label: 'Delete', icon: Trash2, tone: 'danger', onClick: onDelete },
  )

  return <RowActionsMenu actions={actions} />
}

export function VehicleChecksDataTable({
  checks,
  onView,
  onEdit,
  onDelete,
  onReviewDefects,
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
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className={adminTableHeader}>
            <tr className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5499BF] sm:text-sm sm:tracking-[0.06em]">
              <th className={headerPadding}>Date / Time</th>
              <th className={headerPadding}>Vehicle</th>
              <th className={headerPadding}>Worker</th>
              <th className={headerPadding}>Result</th>
              <th className={headerPadding}>Defects</th>
              <th className={headerPadding}>Duration</th>
              <th className={headerPadding}>Review status</th>
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
                  <div className={`truncate ${adminTableEntityName}`}>
                    {check.vehicleRegistration}
                  </div>
                  <div className={`mt-1 text-xs leading-5 sm:text-sm ${adminText}`}>
                    {getVehicleSubline(check)}
                  </div>
                </td>
                <td className={`${cellPadding} align-middle`}>
                  <span className={`block truncate ${adminTableEntityName}`}>
                    {check.workerName}
                  </span>
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
                    check.defectCount > 0
                      ? 'font-semibold text-amber-700 dark:text-amber-300'
                      : adminText
                  }`}
                >
                  {getDefectsLabel(check)}
                </td>
                <td className={`${cellPadding} align-middle tabular-nums font-medium ${adminTextStrong}`}>
                  {getDurationLabel(check)}
                </td>
                <td className={`${cellPadding} align-middle`}>
                  <span
                    className={`${badgeClassName} ${getDefectReviewBadgeClass(check.defectReviewStatus, check.defectCount)}`}
                  >
                    {formatDefectReviewStatusLabel(
                      check.defectReviewStatus,
                      check.defectCount,
                    )}
                  </span>
                </td>
                <TableActionsCell className={rowPadding}>
                  <VehicleCheckRowActions
                    canReview={check.defectCount > 0}
                    onView={() => onView(check)}
                    onEdit={() => onEdit(check)}
                    onDelete={() => onDelete(check)}
                    onReviewDefects={() => onReviewDefects(check)}
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
