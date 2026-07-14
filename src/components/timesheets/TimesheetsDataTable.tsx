import {
  RowActionsMenu,
  TableActionsCell,
  TableActionsHeader,
  type RowAction,
} from '@/components/ui/RowActionsMenu'
import type { TimesheetListItem } from '@/lib/timesheetTypes'
import {
  canEditTimesheet,
  formatHours,
  formatSubmittedAtDisplay,
  formatTimesheetSubmittedAt,
  formatTotalHours,
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/timesheetUtils'
import {
  adminHeading,
  adminTableEntityName,
  adminTableHeadText,
  adminTableHeader,
  adminTableRow,
  adminTableShellSm,
  adminText,
  adminTextMuted,
} from '@/lib/adminUiStyles'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { Check, Eye, Pencil, Trash2, XCircle } from 'lucide-react'

type TimesheetsDataTableProps = {
  timesheets: TimesheetListItem[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (checked: boolean) => void
  onView: (timesheet: TimesheetListItem) => void
  onEdit: (timesheet: TimesheetListItem) => void
  onApprove: (timesheet: TimesheetListItem) => void
  onReject: (timesheet: TimesheetListItem) => void
  onDelete: (timesheet: TimesheetListItem) => void
}

function TimesheetRowActions({
  sheet,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: {
  sheet: TimesheetListItem
  onView: () => void
  onEdit: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
  ]

  if (canEditTimesheet(sheet.status)) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit })
  }

  if (sheet.status === 'Submitted') {
    actions.push(
      {
        id: 'approve',
        label: 'Approve',
        icon: Check,
        tone: 'success',
        onClick: onApprove,
      },
      {
        id: 'reject',
        label: 'Reject',
        icon: XCircle,
        tone: 'warning',
        onClick: onReject,
      },
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

function formatTimesheetTableWeekLabel(weekNumber: number): string {
  return `Week ${weekNumber}`
}

export function TimesheetsDataTable({
  timesheets,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: TimesheetsDataTableProps) {
  const { compactTables } = useCompanySettings()
  const rowPadding = compactTables ? 'py-1' : 'py-1.5'
  const cellText = compactTables ? 'text-[11px]' : 'text-xs'
  const allSelected =
    timesheets.length > 0 && timesheets.every((sheet) => selectedIds.has(sheet.id))
  const someSelected = timesheets.some((sheet) => selectedIds.has(sheet.id))

  return (
    <div className={adminTableShellSm}>
      <div className="max-h-[calc(100vh-22rem)] overflow-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead className={adminTableHeader}>
            <tr className={adminTableHeadText}>
              <th className="w-10 px-2.5 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Select all on page"
                  className="size-3.5 rounded border-slate-300 dark:border-slate-600"
                />
              </th>
              <th className="px-2.5 py-2.5">Worker</th>
              <th className="px-2.5 py-2.5">Week</th>
              <th className="px-2.5 py-2.5">Date range</th>
              <th className="px-2.5 py-2.5">Status</th>
              <th className="px-2.5 py-2.5 whitespace-nowrap">Submitted</th>
              <th className="px-2.5 py-2.5 text-right">Worked</th>
              <th className="px-2.5 py-2.5 text-right">OT</th>
              <th className="px-2.5 py-2.5 text-right">Add. hrs</th>
              <th className="px-2.5 py-2.5 text-right">Total</th>
              <TableActionsHeader />
            </tr>
          </thead>
          <tbody>
            {timesheets.map((sheet) => (
              <tr key={sheet.id} className={`${adminTableRow} ${cellText}`}>
                <td className={`px-2.5 ${rowPadding}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sheet.id)}
                    onChange={() => onToggleSelect(sheet.id)}
                    aria-label={`Select ${sheet.driverName}`}
                    className="size-3.5 rounded border-slate-300 dark:border-slate-600"
                  />
                </td>
                <td className="px-2.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => onEdit(sheet)}
                    className={`max-w-full truncate text-left ${adminTableEntityName} hover:text-[#2563EB] dark:hover:text-blue-300`}
                  >
                    {sheet.driverName}
                  </button>
                </td>
                <td className={`px-2.5 py-2 font-semibold ${adminHeading}`}>
                  {formatTimesheetTableWeekLabel(sheet.weekNumber)}
                </td>
                <td className={`px-2.5 py-2 ${adminTextMuted}`}>{sheet.weekRangeLabel}</td>
                <td className="px-2.5 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(sheet.status)}`}
                  >
                    {getStatusLabel(sheet.status)}
                  </span>
                </td>
                <td className={`px-2.5 py-2 whitespace-nowrap tabular-nums ${adminTextMuted}`}>
                  <div>{formatSubmittedAtDisplay(sheet.submittedAt, sheet.status)}</div>
                  {sheet.cleanedAt ? (
                    <div className="mt-0.5 text-[10px] font-medium text-[#5499BF] dark:text-slate-500">
                      Cleaned {formatTimesheetSubmittedAt(sheet.cleanedAt) ?? '—'}
                    </div>
                  ) : null}
                </td>
                <td className={`px-2.5 py-2 text-right font-semibold tabular-nums ${adminHeading}`}>
                  {formatHours(sheet.workedHours)}
                </td>
                <td className={`px-2.5 py-2 text-right tabular-nums ${adminText}`}>
                  {formatHours(sheet.overtimeHours)}
                </td>
                <td className={`px-2.5 py-2 text-right tabular-nums ${adminText}`}>
                  {formatHours(sheet.additionalHours)}
                </td>
                <td className={`px-2.5 py-2 text-right font-semibold tabular-nums text-[#2563EB] dark:text-blue-300`}>
                  {formatTotalHours(sheet.totalHours)}
                </td>
                <TableActionsCell className={rowPadding}>
                  <TimesheetRowActions
                    sheet={sheet}
                    onView={() => onView(sheet)}
                    onEdit={() => onEdit(sheet)}
                    onApprove={() => onApprove(sheet)}
                    onReject={() => onReject(sheet)}
                    onDelete={() => onDelete(sheet)}
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
