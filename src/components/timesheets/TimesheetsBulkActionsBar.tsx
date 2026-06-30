import { Button } from '@/components/ui/button'
import { Bell, Check, Download, XCircle } from 'lucide-react'

type TimesheetsBulkActionsBarProps = {
  selectedCount: number
  isBusy?: boolean
  onApproveSelected: () => void
  onRejectSelected: () => void
  onReminderSelected: () => void
  onExportSelected: () => void
  onClearSelection: () => void
}

export function TimesheetsBulkActionsBar({
  selectedCount,
  isBusy = false,
  onApproveSelected,
  onRejectSelected,
  onReminderSelected,
  onExportSelected,
  onClearSelection,
}: TimesheetsBulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#2563EB]/20 bg-[#EEF4FF] px-3 py-2">
      <p className="text-xs font-semibold text-[#2A376F]">
        {selectedCount} selected
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={isBusy}
          onClick={onApproveSelected}
          className="h-8 rounded-[10px] bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Check className="mr-1 size-3.5" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={onRejectSelected}
          className="h-8 rounded-[10px] px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          <XCircle className="mr-1 size-3.5" />
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={onReminderSelected}
          className="h-8 rounded-[10px] px-2.5 text-xs font-semibold text-slate-700 hover:bg-white"
        >
          <Bell className="mr-1 size-3.5" />
          Send reminder
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled
          onClick={onExportSelected}
          className="h-8 rounded-[10px] px-2.5 text-xs font-semibold text-slate-400"
          title="Export coming soon"
        >
          <Download className="mr-1 size-3.5" />
          Export
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={onClearSelection}
          className="h-8 rounded-[10px] px-2.5 text-xs font-semibold text-slate-600 hover:bg-white"
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
