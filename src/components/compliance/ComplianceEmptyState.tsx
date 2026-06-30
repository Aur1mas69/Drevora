import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'

type ComplianceEmptyStateProps = {
  message: string
  onAddRecord?: () => void
}

export function ComplianceEmptyState({ message, onAddRecord }: ComplianceEmptyStateProps) {
  return (
    <div className="rounded-[22px] bg-white px-6 py-14 text-center shadow-[0_18px_45px_rgba(59,130,246,0.09)] ring-1 ring-blue-100/70">
      <div className="mx-auto flex size-14 items-center justify-center rounded-[20px] bg-[#EAF4FF] text-[#3B82F6] ring-1 ring-blue-100">
        <Shield className="size-7" strokeWidth={1.9} />
      </div>
      <p className="mt-5 text-lg font-semibold tracking-[-0.02em] text-slate-950">
        No compliance records found
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500">{message}</p>
      {onAddRecord ? (
        <Button
          type="button"
          onClick={onAddRecord}
          className="mt-5 h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          Add compliance record
        </Button>
      ) : null}
    </div>
  )
}
