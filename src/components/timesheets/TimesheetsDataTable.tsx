import { useCompanySettings } from '@/contexts/CompanySettingsContext'
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
  getStatusBadgeClass,
  getStatusLabel,
} from '@/lib/timesheetUtils'
import { Check, Eye, Pencil, Trash2 } from 'lucide-react'

type TimesheetsDataTableProps = {
  timesheets: TimesheetListItem[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (checked: boolean) => void
  onView: (timesheet: TimesheetListItem) => void
  onEdit: (timesheet: TimesheetListItem) => void
  onApprove: (timesheet: TimesheetListItem) => void
  onDelete: (timesheet: TimesheetListItem) => void
}

function TimesheetRowActions({
  sheet,
  onView,
  onEdit,
  onApprove,
  onDelete,
}: {
  sheet: TimesheetListItem
  onView: () => void
  onEdit: () => void
  onApprove: () => void
  onDelete: () => void
}) {
  const actions: RowAction[] = [
    { id: 'view', label: 'View', icon: Eye, onClick: onView },
  ]

  if (canEditTimesheet(sheet.status)) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, onClick: onEdit })
  }

  if (sheet.status === 'Submitted') {
    actions.push({
      id: 'approve',
      label: 'Approve',
      icon: Check,
      tone: 'success',
      onClick: onApprove,
    })
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

export function TimesheetsDataTable({
  timesheets,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  onApprove,
  onDelete,
}: TimesheetsDataTableProps) {
  const { formatDateTime, compactTables } = useCompanySettings()
  const rowPadding = compactTables ? 'py-1' : 'py-1.5'
  const cellText = compactTables ? 'text-[11px]' : 'text-xs'
  const allSelected =
    timesheets.length > 0 && timesheets.every((sheet) => selectedIds.has(sheet.id))
  const someSelected = timesheets.some((sheet) => selectedIds.has(sheet.id))

  return (
    <div className="overflow-hidden rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
      <div className="max-h-[calc(100vh-22rem)] overflow-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#F4F8FF] shadow-[0_1px_0_rgba(75,120,220,0.10)]">
            <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Select all on page"
                  className="size-3.5 rounded border-slate-300"
                />
              </th>
              <th className="px-2 py-2">Worker</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Vehicle</th>
              <th className="px-2 py-2">Hours</th>
              <th className="px-2 py-2">OT</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Updated</th>
              <TableActionsHeader />
            </tr>
          </thead>
          <tbody>
            {timesheets.map((sheet) => (
              <tr
                key={sheet.id}
                className={`border-t border-[rgba(75,120,220,0.06)] ${cellText} transition-colors hover:bg-[#F8FBFF]/70`}
              >
                <td className={`px-2 ${rowPadding}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sheet.id)}
                    onChange={() => onToggleSelect(sheet.id)}
                    aria-label={`Select ${sheet.driverName}`}
                    className="size-3.5 rounded border-slate-300"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(sheet)}
                    className="text-left font-semibold text-[#2A376F] hover:text-[#2563EB]"
                  >
                    {sheet.driverName}
                  </button>
                </td>
                <td className="px-2 py-1.5 text-slate-600">{sheet.driverRole ?? '—'}</td>
                <td className="px-2 py-1.5 text-slate-600">{sheet.vehicleRegistration}</td>
                <td className="px-2 py-1.5 font-semibold tabular-nums text-[#2A376F]">
                  {formatHours(sheet.workedHours)}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-slate-600">
                  {formatHours(sheet.overtimeHours)}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(sheet.status)}`}
                  >
                    {getStatusLabel(sheet.status)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-slate-500">
                  {formatDateTime(sheet.updatedAt)}
                </td>
                <TableActionsCell className={`${rowPadding}`}>
                  <TimesheetRowActions
                    sheet={sheet}
                    onView={() => onView(sheet)}
                    onEdit={() => onEdit(sheet)}
                    onApprove={() => onApprove(sheet)}
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
