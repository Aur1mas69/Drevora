import {
  dashboardOverviewCardBase,
  dashboardOverviewCardStaticClass,
  dashboardOverviewCardSubtitleClass,
  dashboardOverviewCardTitleClass,
  dashboardOverviewDividerClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'

export function DashboardKpiSkeleton() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center">
      <div className="aspect-square w-full max-w-[clamp(6.75rem,34vw,8.75rem)] rounded-full border-2 border-[#CFE3F5] bg-[#DCEEFF]/60 sm:max-w-[11.75rem] lg:max-w-[12.25rem]" />
      <div className="mt-2 h-3 w-20 rounded bg-[#DCEEFF]/60" />
    </div>
  )
}

export function DashboardOverviewCardSkeleton() {
  return (
    <div
      className={`${dashboardOverviewCardBase} h-44 bg-[#F8FBFF]/40`}
      aria-hidden="true"
    />
  )
}

export function RecentActivitySkeleton() {
  return (
    <section
      className={`${dashboardOverviewCardStaticClass} flex min-h-[360px] flex-col sm:min-h-[360px] xl:min-h-[520px]`}
      aria-hidden="true"
    >
      <div className={`shrink-0 border-b ${dashboardOverviewDividerClass} pb-4`}>
        <h3 className={dashboardOverviewCardTitleClass}>Recent Activity</h3>
        <p className={dashboardOverviewCardSubtitleClass}>
          Latest changes across your operation
        </p>
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[4.25rem] rounded-xl border border-[#D2E5F5] bg-[#F8FBFF]/80" />
        ))}
      </div>
    </section>
  )
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="dashboard-kpi-grid grid min-w-0 grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-5 sm:gap-y-6 xl:grid-cols-4 xl:gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardKpiSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <DashboardOverviewCardSkeleton key={index} />
            ))}
          </div>
          <div className={`${dashboardOverviewCardBase} h-56 bg-[#F8FBFF]/40`} aria-hidden="true" />
        </div>
        <RecentActivitySkeleton />
      </div>
    </div>
  )
}

export function DashboardHeroFallback() {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-[#C5DFFB]/70 bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC] px-5 py-8 sm:px-8 sm:py-10"
      aria-hidden="true"
    >
      <div className="max-w-xl space-y-3">
        <div className="h-7 w-48 rounded-lg bg-white/50 sm:h-8 sm:w-64" />
        <div className="h-4 w-56 rounded bg-white/40 sm:w-72" />
      </div>
    </div>
  )
}
