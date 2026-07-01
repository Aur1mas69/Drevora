import { Button } from '@/components/ui/button'
import { adminEmptyState, adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { CalendarDays } from 'lucide-react'

type HolidayRequestsEmptyStateProps = {
  onCreateFirst: () => void
}

export function HolidayRequestsEmptyState({ onCreateFirst }: HolidayRequestsEmptyStateProps) {
  return (
    <div className={adminEmptyState}>
      <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
        No holiday requests yet
      </h2>
      <p className={`mx-auto mt-2 max-w-md text-sm ${adminTextMuted}`}>
        Create the first leave request to start tracking annual leave, approvals and workforce
        availability.
      </p>
      <div className="mt-5">
        <Button
          type="button"
          onClick={onCreateFirst}
          className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          <CalendarDays className="mr-1.5 size-4" />
          Create first request
        </Button>
      </div>
    </div>
  )
}
