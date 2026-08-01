import { adminTextMuted } from '@/lib/adminUiStyles'
import { cn } from '@/lib/utils'

type LegalVersionBadgeProps = {
  version: string
  effectiveDate: string
  className?: string
}

function formatEffectiveDate(value: string): string {
  const trimmed = value.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return trimmed
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) return trimmed
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

/** Compact version + effective date (no DRAFT label). */
export function LegalVersionBadge({
  version,
  effectiveDate,
  className,
}: LegalVersionBadgeProps) {
  const versionLabel = version.startsWith('v') ? version : `v${version}`
  return (
    <p className={cn(`text-sm leading-6 ${adminTextMuted}`, className)}>
      <span className="font-medium text-slate-600 dark:text-slate-300">{versionLabel}</span>
      <span aria-hidden className="mx-1.5 text-slate-400">
        ·
      </span>
      <span>Effective {formatEffectiveDate(effectiveDate)}</span>
    </p>
  )
}
