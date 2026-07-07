import { Button } from '@/components/ui/button'
import { adminEmptyState, adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { ClipboardCheck } from 'lucide-react'

type VehicleChecksEmptyStateProps = {
  onCreateFirst: () => void
}

export function VehicleChecksEmptyState({ onCreateFirst }: VehicleChecksEmptyStateProps) {
  return (
    <div className={adminEmptyState}>
      <h2 className={`text-lg font-semibold tracking-[-0.03em] ${adminHeading}`}>
        No vehicle checks recorded yet.
      </h2>
      <p className={`mx-auto mt-2 max-w-md text-sm ${adminTextMuted}`}>
        Record daily walk-around checks and defect reports for your fleet.
      </p>
      <div className="mt-5">
        <Button
          type="button"
          onClick={onCreateFirst}
          className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          <ClipboardCheck className="mr-1.5 size-4" />
          Create first inspection
        </Button>
      </div>
    </div>
  )
}
