import { Button } from '@/components/ui/button'
import { ClipboardCheck } from 'lucide-react'

type VehicleChecksEmptyStateProps = {
  onCreateFirst: () => void
}

export function VehicleChecksEmptyState({ onCreateFirst }: VehicleChecksEmptyStateProps) {
  return (
    <div className="rounded-[14px] border border-[rgba(75,120,220,0.10)] bg-white px-6 py-10 text-center shadow-[0_2px_8px_rgba(40,80,140,0.04)]">
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
        No inspections yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
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
