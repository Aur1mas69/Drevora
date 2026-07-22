import type { ReactNode } from 'react'
import {
  dashboardOverviewCardActionClass,
  dashboardOverviewCardSubtitleClass,
  dashboardOverviewCardTitleClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { Link } from 'react-router-dom'

type DashboardOverviewCardHeaderProps = {
  title: string
  subtitle?: string
  actionLabel?: string
  actionTo?: string
  /** Optional leading icon/node before the title block */
  leading?: ReactNode
}

export function DashboardOverviewCardHeader({
  title,
  subtitle,
  actionLabel = 'View',
  actionTo,
  leading,
}: DashboardOverviewCardHeaderProps) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3 sm:mb-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {leading}
        <div className="min-w-0">
          <h3 className={dashboardOverviewCardTitleClass}>{title}</h3>
          {subtitle ? <p className={dashboardOverviewCardSubtitleClass}>{subtitle}</p> : null}
        </div>
      </div>
      {actionTo ? (
        <Link
          to={actionTo}
          className={dashboardOverviewCardActionClass}
          aria-label={`${actionLabel} ${title}`}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
