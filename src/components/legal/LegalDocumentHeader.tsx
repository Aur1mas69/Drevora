import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge'
import { Button } from '@/components/ui/button'
import { adminHeading, adminTextMuted } from '@/lib/adminUiStyles'
import { cn } from '@/lib/utils'

type LegalDocumentHeaderProps = {
  title: string
  version: string
  effectiveDate: string
  subtitle?: ReactNode
  showPrint?: boolean
  extra?: ReactNode
  className?: string
}

export function LegalDocumentHeader({
  title,
  version,
  effectiveDate,
  subtitle,
  showPrint = true,
  extra,
  className,
}: LegalDocumentHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] print:text-slate-600">
            Legal
          </p>
          <h1 className={`text-3xl font-semibold tracking-[-0.03em] ${adminHeading}`}>{title}</h1>
          <LegalVersionBadge version={version} effectiveDate={effectiveDate} />
          {subtitle ? (
            <div className={`max-w-3xl text-sm leading-6 ${adminTextMuted}`}>{subtitle}</div>
          ) : null}
        </div>
        {showPrint ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="legal-print-hide shrink-0 gap-1.5 rounded-xl"
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" aria-hidden />
            Print
          </Button>
        ) : null}
      </div>
      {extra}
    </header>
  )
}
