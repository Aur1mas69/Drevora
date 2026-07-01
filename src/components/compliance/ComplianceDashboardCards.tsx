import type { ComplianceDashboardStats } from '@/lib/complianceTypes'
import { adminHeadingLg, adminPanelLg, adminTextMuted } from '@/lib/adminUiStyles'
import { AlertTriangle, Truck, Users } from 'lucide-react'

type ComplianceDashboardCardsProps = {
  stats: ComplianceDashboardStats
}

const cards = [
  {
    key: 'totalWorkers' as const,
    label: 'Total Workers',
    detail: 'Active workforce tracked',
    icon: Users,
    accent:
      'text-[#2563EB] bg-blue-50 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
  },
  {
    key: 'workersWithExpiringDocuments' as const,
    label: 'Workers With Expiring Documents',
    detail: 'Within 60 days',
    icon: AlertTriangle,
    accent:
      'text-amber-600 bg-amber-50 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
  },
  {
    key: 'expiredDocuments' as const,
    label: 'Expired Documents',
    detail: 'Requires immediate action',
    icon: AlertTriangle,
    accent:
      'text-rose-600 bg-rose-50 ring-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900/60',
  },
  {
    key: 'vehicleComplianceAlerts' as const,
    label: 'Vehicle Compliance Alerts',
    detail: 'Expiring or expired items',
    icon: Truck,
    accent:
      'text-violet-600 bg-violet-50 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900/60',
  },
]

export function ComplianceDashboardCards({ stats }: ComplianceDashboardCardsProps) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.key} className={`${adminPanelLg} p-[22px] dark:bg-slate-900/70`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-semibold ${adminTextMuted}`}>{card.label}</p>
                <p
                  className={`mt-3 text-[2.4rem] font-semibold leading-none tracking-[-0.06em] ${adminHeadingLg}`}
                >
                  {stats[card.key]}
                </p>
                <p className={`mt-2 text-xs font-medium ${adminTextMuted}`}>{card.detail}</p>
              </div>
              <div
                className={`flex size-[52px] items-center justify-center rounded-[18px] ring-1 ${card.accent}`}
              >
                <Icon className="size-[26px]" strokeWidth={1.85} aria-hidden="true" />
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
