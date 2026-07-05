import { Button } from '@/components/ui/button'
import { Check, Download } from 'lucide-react'

type TimesheetsBulkActionsBarProps = {
  selectedCount: number
  submittedCount: number
  isBusy?: boolean
  isExporting?: boolean
  onApproveSelected: () => void
  onExportSelected: () => void
  onClearSelection: () => void
}

export function TimesheetsBulkActionsBar({
  selectedCount,
  submittedCount,
  isBusy = false,
  isExporting = false,
  onApproveSelected,
  onExportSelected,
  onClearSelection,
}: TimesheetsBulkActionsBarProps) {
  if (selectedCount === 0) return null

  const hasMixedSelection = submittedCount > 0 && submittedCount < selectedCount
  const canBulkApprove = submittedCount > 0 && !isBusy && !isExporting
  const canExport = !isBusy && !isExporting

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#D3E9FC] bg-[#F5FAFF] px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/70">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#113C69] dark:text-slate-100">
          {selectedCount} selected
        </p>
        {submittedCount === 0 ? (
          <p className="mt-0.5 text-[11px] font-medium text-[#3D7A9C] dark:text-slate-400">
            Only submitted timesheets can be approved.
          </p>
        ) : hasMixedSelection ? (
          <p className="mt-0.5 text-[11px] font-medium text-[#3D7A9C] dark:text-slate-400">
            Approve submitted timesheets ({submittedCount} of {selectedCount}).
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={!canBulkApprove}
          onClick={onApproveSelected}
          className="h-8 rounded-[10px] bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-600/40 disabled:text-white/80"
        >
          <Check className="mr-1 size-3.5" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!canExport}
          onClick={onExportSelected}
          className="h-8 rounded-[10px] bg-white px-2.5 text-xs font-semibold text-[#0B68BE] ring-1 ring-[#D3E9FC] hover:bg-[#E8F3FE] disabled:opacity-60 dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10"
        >
          <Download className="mr-1 size-3.5" />
          {isExporting ? 'Exporting…' : 'Export'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isBusy || isExporting}
          onClick={onClearSelection}
          className="h-8 rounded-[10px] px-2.5 text-xs font-semibold text-[#0D477F] hover:bg-[#E8F3FE] dark:text-slate-300 dark:hover:bg-slate-800/50"
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
