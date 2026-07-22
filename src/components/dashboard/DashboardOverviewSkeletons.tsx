import { dashboardOverviewCardBase } from '@/components/dashboard/dashboardOverviewCardStyles'

export function DashboardKpiSkeleton() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center">
      <div className="aspect-square w-full max-w-[clamp(6.75rem,34vw,8.75rem)] rounded-full border-2 border-[#CFE3F5] bg-[#DCEEFF]/60 dark:border-slate-600 dark:bg-slate-800/60 sm:max-w-[11.75rem] lg:max-w-[12.25rem]" />
      <div className="mt-2 h-3 w-20 rounded bg-[#DCEEFF]/60 dark:bg-slate-800/60" />
    </div>
  )
}

export function DashboardOverviewCardSkeleton() {
  return (
    <div
      className={`${dashboardOverviewCardBase} h-full min-h-44 bg-[#F8FBFF]/40 dark:bg-slate-800/40`}
      aria-hidden="true"
    />
  )
}

/** Elevated tinted Recent Activity panel skeleton. */
export function RecentActivitySkeleton() {
  return (
    <div
      className="relative flex h-full min-h-44 min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#8EC8F0]/55 bg-[linear-gradient(165deg,#D7EDFF_0%,#E8F4FF_28%,#F2F8FF_62%,#DEEEFF_100%)] p-4 shadow-[0_14px_36px_rgba(37,99,235,0.16)] sm:p-5 xl:min-h-[28rem] dark:border-sky-700/40 dark:bg-slate-900/80"
      aria-hidden="true"
    >
      <div className="mb-4 border-b border-[#A8D4F5]/55 pb-3.5 dark:border-sky-800/50">
        <div className="flex items-center gap-2">
          <div className="h-4 w-32 rounded bg-[#B8DCF7]/80 dark:bg-slate-700/50" />
          <div className="h-3.5 w-10 rounded-full bg-emerald-100/90 dark:bg-emerald-950/40" />
        </div>
        <div className="mt-2 h-3 w-28 rounded bg-[#C5E3F8]/70 dark:bg-slate-700/40" />
      </div>
      <div className="flex-1 space-y-2.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-[4.25rem] rounded-2xl bg-white/55 shadow-[0_2px_10px_rgba(59,130,246,0.08)] dark:bg-slate-800/50"
          />
        ))}
      </div>
    </div>
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
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <DashboardOverviewCardSkeleton key={`top-${index}`} />
        ))}
        <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 xl:col-span-1 xl:row-span-3">
          <div
            className={`${dashboardOverviewCardBase} min-h-28 bg-[#F8FBFF]/40 dark:bg-slate-800/40`}
            aria-hidden="true"
          />
          <div className="min-h-0 min-w-0 flex-1 [&_>_*]:h-full">
            <RecentActivitySkeleton />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <DashboardOverviewCardSkeleton key={`mid-${index}`} />
        ))}
        <div className="min-w-0 xl:col-span-2 [&_>_*]:h-full">
          <DashboardOverviewCardSkeleton />
        </div>
        <div className="min-w-0 [&_>_*]:h-full">
          <DashboardOverviewCardSkeleton />
        </div>
      </div>
    </div>
  )
}

export function DashboardHeroFallback() {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-[#C5DFFB]/70 bg-gradient-to-br from-[#E8F3FE] via-[#DFEEFF] to-[#D3E9FC] px-5 py-8 dark:border-white/10 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 sm:px-8 sm:py-10"
      aria-hidden="true"
    >
      <div className="max-w-xl space-y-3">
        <div className="h-7 w-48 rounded-lg bg-white/50 dark:bg-slate-700/50 sm:h-8 sm:w-64" />
        <div className="h-4 w-56 rounded bg-white/40 dark:bg-slate-700/40 sm:w-72" />
      </div>
    </div>
  )
}
