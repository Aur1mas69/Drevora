import { Button } from '@/components/ui/button'
import { adminEmptyStateLg, adminHeadingLg, adminTextMuted } from '@/lib/adminUiStyles'
import { Shield } from 'lucide-react'

type ComplianceEmptyStateProps = {
  message: string
  onAddRecord?: () => void
}

export function ComplianceEmptyState({ message, onAddRecord }: ComplianceEmptyStateProps) {
  return (
    <div className={adminEmptyStateLg}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-[20px] bg-[#EAF4FF] text-[#3B82F6] ring-1 ring-blue-100 dark:bg-slate-800/70 dark:text-blue-300 dark:ring-white/10">
        <Shield className="size-7" strokeWidth={1.9} />
      </div>
      <p className={`mt-5 text-lg font-semibold tracking-[-0.02em] ${adminHeadingLg}`}>
        No compliance records found
      </p>
      <p className={`mx-auto mt-2 max-w-md text-sm font-medium ${adminTextMuted}`}>{message}</p>
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
