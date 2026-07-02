import { TimesheetWeekLabel } from '@/components/timesheets/TimesheetWeekLabel'
import { Button } from '@/components/ui/button'
import { adminEmptyState, adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { Users } from 'lucide-react'

type TimesheetsEmptyStateProps = {
  weekTitle: string
  weekRangeLabel: string
  onCreateWeekly: () => void
  onCreateSingle: () => void
  isCreating?: boolean
}

export function TimesheetsEmptyState({
  weekTitle,
  weekRangeLabel,
  onCreateWeekly,
  onCreateSingle,
  isCreating = false,
}: TimesheetsEmptyStateProps) {
  return (
    <div className={adminEmptyState}>
      <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
        No timesheets for
      </h2>
      <div className="mx-auto mt-1 max-w-md">
        <TimesheetWeekLabel
          weekTitle={weekTitle}
          weekRangeLabel={weekRangeLabel}
          titleClassName={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}
          rangeClassName={`text-sm ${adminTextMuted}`}
        />
      </div>
      <p className={`mx-auto mt-2 max-w-md text-sm ${adminTextMuted}`}>
        Create weekly draft timesheets for all active drivers, or add a single worker timesheet.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          onClick={onCreateWeekly}
          disabled={isCreating}
          className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          <Users className="mr-1.5 size-4" />
          Create weekly timesheets for active drivers
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCreateSingle}
          disabled={isCreating}
          className="h-10 rounded-[12px] px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
        >
          Create for one worker
        </Button>
      </div>
    </div>
  )
}
