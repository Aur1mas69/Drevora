import { Button } from '@/components/ui/button'
import { CalendarDays } from 'lucide-react'
import { holidayPageCardClass, holidayPrimaryButtonClass } from './holidayUiStyles'

type HolidayRequestsEmptyStateProps = {
  onCreateFirst: () => void
}

export function HolidayRequestsEmptyState({ onCreateFirst }: HolidayRequestsEmptyStateProps) {
  return (
    <div className={`px-6 py-12 text-center ${holidayPageCardClass}`}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#218EE7] ring-1 ring-[#C5DFFB]">
        <CalendarDays className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-[#113C69]">
        No holiday requests found.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#5499BF]">
        Create a new holiday request to start tracking worker leave, approvals and declined requests.
      </p>
      <div className="mt-5">
        <Button type="button" onClick={onCreateFirst} className={holidayPrimaryButtonClass}>
          <CalendarDays className="mr-1.5 size-4" />
          New Holiday Request
        </Button>
      </div>
    </div>
  )
}
