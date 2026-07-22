import type { FleetComplianceAlert, FleetComplianceAlertsSummary } from '@/lib/fleetComplianceAlerts'
import {
  dashboardOverviewCardClass,
  dashboardOverviewInnerRowClass,
  dashboardOverviewMiniStatLabelClass,
  dashboardOverviewMiniStatTileClass,
  dashboardOverviewMiniStatValueClass,
  dashboardOverviewRowHelperClass,
  dashboardOverviewRowLabelClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { DashboardOverviewCardHeader } from '@/components/dashboard/DashboardOverviewCardHeader'
import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

type CountTone = {
  label: string
  value: number
  valueClass: string
  wrapClass: string
}

function buildCountTiles(summary: FleetComplianceAlertsSummary): CountTone[] {
  return [
    {
      label: 'Overdue',
      value: summary.overdueCount,
      valueClass: 'text-red-600 dark:text-red-400',
      wrapClass: 'border-red-200/70 bg-red-50/90 dark:border-red-900/40 dark:bg-red-950/30',
    },
    {
      label: 'Due within 7 days',
      value: summary.within7Count,
      valueClass: 'text-orange-600 dark:text-orange-400',
      wrapClass:
        'border-orange-200/70 bg-orange-50/90 dark:border-orange-900/40 dark:bg-orange-950/30',
    },
    {
      label: 'Due within 30 days',
      value: summary.within30Count,
      valueClass: 'text-amber-600 dark:text-amber-400',
      wrapClass: 'border-amber-200/70 bg-amber-50/90 dark:border-amber-900/40 dark:bg-amber-950/30',
    },
  ]
}

function bucketDotClass(bucket: FleetComplianceAlert['bucket']): string {
  if (bucket === 'overdue') return 'bg-red-500'
  if (bucket === 'within_7') return 'bg-orange-500'
  return 'bg-amber-500'
}

function AlertRow({ alert }: { alert: FleetComplianceAlert }) {
  return (
    <li>
      <Link
        to={alert.path}
        className={`flex items-start gap-2.5 ${dashboardOverviewInnerRowClass}`}
      >
        <span
          className={`mt-1.5 size-2 shrink-0 rounded-full ${bucketDotClass(alert.bucket)}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className={`truncate ${dashboardOverviewRowLabelClass}`}>
            {alert.registration} · {alert.typeLabel}
          </p>
          <p className={`mt-0.5 ${dashboardOverviewRowHelperClass}`}>{alert.timingText}</p>
        </div>
      </Link>
    </li>
  )
}

export function FleetComplianceAlertsCard({
  summary,
}: {
  summary: FleetComplianceAlertsSummary
}) {
  const counts = buildCountTiles(summary)
  const hasAlerts =
    summary.overdueCount + summary.within7Count + summary.within30Count > 0

  return (
    <section className={`${dashboardOverviewCardClass} flex h-full flex-col`}>
      <DashboardOverviewCardHeader
        title="Fleet Compliance Alerts"
        subtitle="Document and service due dates"
        actionLabel="View all"
        actionTo="/vehicles"
      />

      <div className="grid grid-cols-3 gap-2">
        {counts.map((tile) => (
          <div
            key={tile.label}
            className={`${dashboardOverviewMiniStatTileClass} ${tile.wrapClass}`}
          >
            <p className={dashboardOverviewMiniStatLabelClass}>{tile.label}</p>
            <p className={`${dashboardOverviewMiniStatValueClass} ${tile.valueClass}`}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {hasAlerts ? (
        <ul className="mt-3 space-y-2">
          {summary.topAlerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      ) : (
        <div
          className={`mt-auto flex items-start gap-3 ${dashboardOverviewInnerRowClass} border-emerald-200/70 bg-emerald-50/90 dark:border-emerald-900/40 dark:bg-emerald-950/25`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/50">
            <CheckCircle2
              className="size-4 text-emerald-600 dark:text-emerald-400"
              strokeWidth={2.1}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              All clear
            </p>
            <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-400/80">
              All fleet documents are up to date.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
