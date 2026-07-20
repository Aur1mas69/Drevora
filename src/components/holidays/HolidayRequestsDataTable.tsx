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
  canDeleteHolidayRequest,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/holidayRequestUtils'
import { adminTableEntityName } from '@/lib/adminUiStyles'
import { Check, Eye, Pencil, Trash2, X } from 'lucide-react'
import {
  holidayMobileCardClass,
  holidayTableHeadClass,
  holidayTableRowClass,
  holidayTableShellClass,
} from './holidayUiStyles'

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
    { id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit },
  ]

  if (canApproveHolidayRequest(request.status)) {
    actions.push(
      { id: 'approve', label: 'Approve', icon: Check, tone: 'success', onClick: onApprove },
      { id: 'decline', label: 'Decline', icon: X, tone: 'warning', onClick: onReject },
    )
  }

  if (canDeleteHolidayRequest(request.status)) {
    actions.push({
      id: 'delete',
      label: 'Delete request',
      icon: Trash2,
      tone: 'danger',
      onClick: onDelete,
    })
  }

  return <RowActionsMenu actions={actions} />
}

function StatusBadge({ status }: { status: HolidayRequest['status'] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${getStatusBadgeClass(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  )
}

function LeaveTypeBadge({ leaveType }: { leaveType: HolidayRequest['leaveType'] }) {
  const className =
    leaveType === 'unpaid_leave'
      ? 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-white/10'
      : leaveType === 'bank_holiday'
        ? 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60'
        : 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900/60'
  const label =
    leaveType === 'unpaid_leave'
      ? 'Unpaid leave'
      : leaveType === 'bank_holiday'
        ? 'Bank holiday'
        : 'Paid holiday'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  )
}

function HolidayRequestMobileCard({
  request,
  formatDate,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: {
  request: HolidayRequest
  formatDate: (value: string) => string
  onView: () => void
  onEdit: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}) {
  return (
    <article className={holidayMobileCardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`truncate ${adminTableEntityName}`}>{request.workerName}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {request.workerEmploymentType ? (
              <span className="rounded-full bg-[#EFF7FF] px-2 py-0.5 text-[10px] font-bold text-[#0B68BE] ring-1 ring-[#D3E9FC]">
                {request.workerEmploymentType}
              </span>
            ) : null}
            <LeaveTypeBadge leaveType={request.leaveType} />
          </div>
          <p className="mt-1 text-xs tabular-nums text-[#5499BF]">
            {formatDate(request.startDate)} – {formatDate(request.endDate)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="font-medium uppercase tracking-[0.06em] text-[#5499BF]">Days</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
            Holiday deducted: {request.holidayDaysDeducted}
          </dd>
          <dd className="mt-0.5 text-[11px] tabular-nums text-[#5499BF]">
            Calendar away: {request.calendarDaysTotal}
          </dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-[0.06em] text-[#5499BF]">Requested</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-[#113C69]">
            {formatDate(request.createdAt.slice(0, 10))}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end border-t border-[#D3E9FC]/60 pt-3">
        <HolidayRequestRowActions
          request={request}
          onView={onView}
          onEdit={onEdit}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
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
  const rowPadding = compactTables ? 'py-2' : 'py-2.5'
  const cellText = compactTables ? 'text-[11px]' : 'text-xs'

  return (
    <>
      <div className={`md:hidden space-y-3 ${holidayTableShellClass} p-3`}>
        {requests.map((request) => (
          <HolidayRequestMobileCard
            key={request.id}
            request={request}
            formatDate={formatDate}
            onView={() => onView(request)}
            onEdit={() => onEdit(request)}
            onApprove={() => onApprove(request)}
            onReject={() => onReject(request)}
            onDelete={() => onDelete(request)}
          />
        ))}
      </div>

      <div className={`hidden md:block ${holidayTableShellClass}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className={holidayTableHeadClass}>
                <th className="px-4 py-2.5">Worker</th>
                <th className="px-4 py-2.5">Employment</th>
                <th className="px-4 py-2.5">Leave Type</th>
                <th className="px-4 py-2.5">Start Date</th>
                <th className="px-4 py-2.5">End Date</th>
                <th className="px-4 py-2.5">Days</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Requested Date</th>
                <TableActionsHeader className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className={`${holidayTableRowClass} ${cellText}`}>
                  <td className={`max-w-[200px] px-4 ${rowPadding}`}>
                    <span className={`block truncate ${adminTableEntityName}`}>
                      {request.workerName}
                    </span>
                  </td>
                  <td className={`px-4 ${rowPadding} text-[#5499BF]`}>
                    {request.workerEmploymentType ?? 'Not set'}
                  </td>
                  <td className={`px-4 ${rowPadding}`}>
                    <LeaveTypeBadge leaveType={request.leaveType} />
                  </td>
                  <td className={`px-4 ${rowPadding} tabular-nums font-medium text-[#113C69]`}>
                    {formatDate(request.startDate)}
                  </td>
                  <td className={`px-4 ${rowPadding} tabular-nums font-medium text-[#113C69]`}>
                    {formatDate(request.endDate)}
                  </td>
                  <td className={`px-4 ${rowPadding}`}>
                    <div className="font-semibold tabular-nums text-[#113C69]">
                      Holiday deducted: {request.holidayDaysDeducted}
                    </div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-[#5499BF]">
                      Calendar away: {request.calendarDaysTotal}
                    </div>
                  </td>
                  <td className={`px-4 ${rowPadding}`}>
                    <StatusBadge status={request.status} />
                  </td>
                  <td className={`px-4 ${rowPadding} tabular-nums text-[#5499BF]`}>
                    {formatDate(request.createdAt.slice(0, 10))}
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
    </>
  )
}
