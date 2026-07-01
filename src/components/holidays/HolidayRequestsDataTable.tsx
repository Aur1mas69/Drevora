import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
import {
  canApproveHolidayRequest,
  canEditHolidayRequest,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/holidayRequestUtils'
import {
  adminHeading,
  adminTableHeadText,
  adminTableHeader,
  adminTableRow,
  adminTableShellSm,
  adminText,
  adminTextStrong,
} from '@/lib/adminUiStyles'
import { Check, Eye, Pencil, Trash2, X } from 'lucide-react'

type HolidayRequestsDataTableProps = {
  requests: HolidayRequest[]
  onView: (request: HolidayRequest) => void
  onEdit: (request: HolidayRequest) => void
  onApprove: (request: HolidayRequest) => void
  onReject: (request: HolidayRequest) => void
  onDelete: (request: HolidayRequest) => void
}

function HolidayRequestRowActions({
  request,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: {
  request: HolidayRequest
  onView: () => void
  onEdit: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
  ]

  if (canEditHolidayRequest(request.status)) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit })
  }

  if (canApproveHolidayRequest(request.status)) {
    actions.push(
      { id: 'approve', label: 'Approve', icon: Check, tone: 'success', onClick: onApprove },
      { id: 'reject', label: 'Reject', icon: X, tone: 'warning', onClick: onReject },
    )
  }

  actions.push({
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    tone: 'danger',
    onClick: onDelete,
  })

  return <RowActionsMenu actions={actions} />
}

export function HolidayRequestsDataTable({
  requests,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: HolidayRequestsDataTableProps) {
  const { formatDate, compactTables } = useCompanySettings()
  const rowPadding = compactTables ? 'py-1' : 'py-1.5'
  const cellText = compactTables ? 'text-[11px]' : 'text-xs'

  return (
    <div className={adminTableShellSm}>
      <div className="max-h-[calc(100vh-24rem)] overflow-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead className={adminTableHeader}>
            <tr className={adminTableHeadText}>
              <th className="px-3 py-2">Worker</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Start Date</th>
              <th className="px-3 py-2">End Date</th>
              <th className="px-3 py-2">Total Days</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason</th>
              <TableActionsHeader />
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className={`${adminTableRow} ${cellText}`}>
                <td className={`px-3 ${rowPadding} font-medium ${adminHeading}`}>
                  {request.workerName}
                </td>
                <td className={`px-3 ${rowPadding} ${adminText}`}>
                  {request.workerRole ?? '—'}
                </td>
                <td className={`px-3 ${rowPadding} tabular-nums ${adminTextStrong}`}>
                  {formatDate(request.startDate)}
                </td>
                <td className={`px-3 ${rowPadding} tabular-nums ${adminTextStrong}`}>
                  {formatDate(request.endDate)}
                </td>
                <td className={`px-3 ${rowPadding} tabular-nums font-medium ${adminTextStrong}`}>
                  {request.totalDays}
                </td>
                <td className={`px-3 ${rowPadding}`}>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(request.status)}`}
                  >
                    {getStatusLabel(request.status)}
                  </span>
                </td>
                <td className={`max-w-[200px] truncate px-3 ${rowPadding} ${adminText}`}>
                  {request.reason?.trim() || '—'}
                </td>
                <TableActionsCell className={rowPadding}>
                  <HolidayRequestRowActions
                    request={request}
                    onView={() => onView(request)}
                    onEdit={() => onEdit(request)}
                    onApprove={() => onApprove(request)}
                    onReject={() => onReject(request)}
                    onDelete={() => onDelete(request)}
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
