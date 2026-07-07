import {
  formatLicenceCategoryLabel,
  formatLicenceCategoryShortLabel,
} from '@/lib/workerProfileUtils'
import type { LicenceCategory } from '@/services/driversService'
import { cn } from '@/lib/utils'

const licenceBadgeClass =
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 bg-[#E8F3FE] text-[#0B68BE] ring-[#C5DFFB]/80 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900/50'

type WorkerLicenceCategoryBadgesProps = {
  categories: LicenceCategory[] | null | undefined
  variant?: 'full' | 'short'
  emptyLabel?: string
  className?: string
  badgeClassName?: string
}

export function WorkerLicenceCategoryBadges({
  categories,
  variant = 'full',
  emptyLabel = 'Not set',
  className,
  badgeClassName,
}: WorkerLicenceCategoryBadgesProps) {
  if (!categories?.length) {
    return <span className="text-sm font-medium text-slate-400">{emptyLabel}</span>
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {categories.map((category) => (
        <span key={category} className={cn(licenceBadgeClass, badgeClassName)}>
          {variant === 'short'
            ? formatLicenceCategoryShortLabel(category)
            : formatLicenceCategoryLabel(category)}
        </span>
      ))}
    </div>
  )
}
