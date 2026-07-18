import { ConsumablesOverviewCard } from '@/components/dashboard/ConsumablesOverviewCard'
import { DailyVehicleChecksStatsCard } from '@/components/dashboard/DailyVehicleChecksStatsCard'
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard'
import {
  DashboardKpiSkeleton,
  DashboardOverviewCardSkeleton,
  RecentActivitySkeleton,
} from '@/components/dashboard/DashboardOverviewSkeletons'
import { DriverReportsOverviewCard } from '@/components/dashboard/DriverReportsOverviewCard'
import { FleetStatusOverviewCard } from '@/components/dashboard/FleetStatusOverviewCard'
import { HolidayRequestsOverviewCard } from '@/components/dashboard/HolidayRequestsOverviewCard'
import { NotesPlansCard } from '@/components/dashboard/NotesPlansCard'
import { TimesheetOverviewCard } from '@/components/dashboard/TimesheetOverviewCard'
import {
  dashboardOverviewCardStaticClass,
  dashboardOverviewCardSubtitleClass,
  dashboardOverviewCardTitleClass,
  dashboardOverviewDividerClass,
} from '@/components/dashboard/dashboardOverviewCardStyles'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { DashboardLoadingState } from '@/hooks/useDashboardStats'
import {
  markVehicleCheckWarningSeen,
  shouldShowVehicleCheckWarningBadge,
} from '@/lib/vehicleCheckWarningSeen'
import { getCompanyTodayIsoDate } from '@/lib/companyDate'
import {
  getDashboardActivityRoute,
  type DashboardRecentActivity,
  type DashboardStats,
} from '@/services/dashboardService'
import {
  ClipboardCheck,
  FileBarChart,
  Truck,
  Users,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

type ActivityAccent = {
  label: string
  boxClass: string
  pillClass: string
  stripeClass: string
  hoverClass: string
}

const OFF_ROAD_WARNING_STATUSES = [
  'off road',
  'maintenance',
  'workshop',
  'out of service',
]

function isAvailabilityWarningStatus(title: string): boolean {
  const status = title.split(' — ')[1]?.trim().toLowerCase() ?? ''
  return OFF_ROAD_WARNING_STATUSES.some((value) => status.includes(value))
}

function getActivityAccent(activity: DashboardRecentActivity): ActivityAccent {
  switch (activity.type) {
    case 'worker':
      return {
        label: 'Worker',
        stripeClass: 'border-l-[#3B82F6] dark:border-l-blue-400',
        boxClass:
          'border-[#CFE3F5]/80 bg-[#F8FBFF]/95 dark:border-blue-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#CFE3F5] hover:bg-[#F8FBFF] hover:shadow-md hover:shadow-[rgba(22,58,99,0.06)] dark:hover:border-blue-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#DCEEFF] text-[#3B82F6] ring-1 ring-[#CFE3F5]/50 dark:bg-blue-950/55 dark:text-blue-300 dark:ring-blue-500/30',
      }
    case 'vehicle':
      return {
        label: 'Vehicle',
        stripeClass: 'border-l-[#2BB8D4] dark:border-l-cyan-400',
        boxClass:
          'border-[#B8EBF5]/80 bg-[#F2FCFE]/95 dark:border-cyan-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#9FE0EF] hover:bg-[#EAF9FC] hover:shadow-md hover:shadow-[#2BB8D4]/10 dark:hover:border-cyan-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#E6F9FC] text-[#0E8FA8] ring-1 ring-[#B8EBF5]/50 dark:bg-cyan-950/55 dark:text-cyan-300 dark:ring-cyan-500/30',
      }
    case 'availability':
      if (isAvailabilityWarningStatus(activity.title)) {
        return {
          label: 'Fleet',
          stripeClass: 'border-l-[#E8843A] dark:border-l-orange-400',
          boxClass:
            'border-[#FFDCC8]/80 bg-[#FFF8F3]/95 dark:border-orange-500/25 dark:bg-slate-800/75',
          hoverClass:
            'hover:border-[#FFCFAF] hover:bg-[#FFF3EB] hover:shadow-md hover:shadow-[#E8843A]/10 dark:hover:border-orange-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
          pillClass:
            'bg-[#FFEDE3] text-[#C65A12] ring-1 ring-[#FFDCC8]/60 dark:bg-orange-950/55 dark:text-orange-300 dark:ring-orange-500/30',
        }
      }
      return {
        label: 'Vehicle',
        stripeClass: 'border-l-[#2BB8D4] dark:border-l-cyan-400',
        boxClass:
          'border-[#B8EBF5]/80 bg-[#F2FCFE]/95 dark:border-cyan-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#9FE0EF] hover:bg-[#EAF9FC] hover:shadow-md hover:shadow-[#2BB8D4]/10 dark:hover:border-cyan-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#E6F9FC] text-[#0E8FA8] ring-1 ring-[#B8EBF5]/50 dark:bg-cyan-950/55 dark:text-cyan-300 dark:ring-cyan-500/30',
      }
    case 'holiday_request':
      return {
        label: 'Holiday',
        stripeClass: 'border-l-[#A855C8] dark:border-l-violet-400',
        boxClass:
          'border-[#E9D5FF]/80 bg-[#FAF5FF]/95 dark:border-violet-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#DCC4F5] hover:bg-[#F5EDFF] hover:shadow-md hover:shadow-[#A855C8]/10 dark:hover:border-violet-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#F3E8FF] text-[#7E3FA8] ring-1 ring-[#E9D5FF]/60 dark:bg-violet-950/55 dark:text-violet-300 dark:ring-violet-500/30',
      }
    case 'timesheet':
      return {
        label: 'Timesheet',
        stripeClass: 'border-l-[#22A861] dark:border-l-emerald-400',
        boxClass:
          'border-[#BBEAD0]/80 bg-[#F3FBF6]/95 dark:border-emerald-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#A3DFC0] hover:bg-[#EBF8F0] hover:shadow-md hover:shadow-[#22A861]/10 dark:hover:border-emerald-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#E3F6EA] text-[#1A7A45] ring-1 ring-[#BBEAD0]/60 dark:bg-emerald-950/55 dark:text-emerald-300 dark:ring-emerald-500/30',
      }
    case 'vehicle_check':
      if (activity.severity === 'danger') {
        return {
          label: 'Check Failed',
          stripeClass: 'border-l-[#DC2626] dark:border-l-rose-400',
          boxClass:
            'border-[#FECACA]/80 bg-[#FFF1F2]/95 dark:border-rose-500/25 dark:bg-slate-800/75',
          hoverClass:
            'hover:border-[#FCA5A5] hover:bg-[#FFE4E6] hover:shadow-md hover:shadow-[#DC2626]/10 dark:hover:border-rose-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
          pillClass:
            'bg-[#FFE4E6] text-[#BE123C] ring-1 ring-[#FECACA]/60 dark:bg-rose-950/55 dark:text-rose-300 dark:ring-rose-500/30',
        }
      }
      if (activity.severity === 'warning') {
        return {
          label: 'Check Issue',
          stripeClass: 'border-l-[#EA580C] dark:border-l-orange-400',
          boxClass:
            'border-[#FED7AA]/80 bg-[#FFF7ED]/95 dark:border-orange-500/25 dark:bg-slate-800/75',
          hoverClass:
            'hover:border-[#FDBA74] hover:bg-[#FFEDD5] hover:shadow-md hover:shadow-[#EA580C]/10 dark:hover:border-orange-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
          pillClass:
            'bg-[#FFEDD5] text-[#C2410C] ring-1 ring-[#FED7AA]/60 dark:bg-orange-950/55 dark:text-orange-300 dark:ring-orange-500/30',
        }
      }
      return {
        label: 'Vehicle Check',
        stripeClass: 'border-l-[#14A89E] dark:border-l-teal-400',
        boxClass:
          'border-[#B8EBE8]/80 bg-[#F0FAFA]/95 dark:border-teal-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#9FE0DC] hover:bg-[#E8F7F6] hover:shadow-md hover:shadow-[#14A89E]/10 dark:hover:border-teal-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#E0F5F3] text-[#0F7A72] ring-1 ring-[#B8EBE8]/60 dark:bg-teal-950/55 dark:text-teal-300 dark:ring-teal-500/30',
      }
    case 'driver_report':
      return {
        label: 'Driver Report',
        stripeClass: 'border-l-[#F08A24] dark:border-l-amber-400',
        boxClass:
          'border-[#FFDDB8]/80 bg-[#FFF9F3]/95 dark:border-amber-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#FFD0A0] hover:bg-[#FFF4EA] hover:shadow-md hover:shadow-[#F08A24]/10 dark:hover:border-amber-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#FFEDD5] text-[#C45F08] ring-1 ring-[#FFDDB8]/60 dark:bg-amber-950/55 dark:text-amber-300 dark:ring-amber-500/30',
      }
    case 'document':
      return {
        label: 'Document',
        stripeClass: 'border-l-[#64748B] dark:border-l-slate-400',
        boxClass:
          'border-[#D5DEE8]/80 bg-[#F8FAFC]/95 dark:border-slate-500/30 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#C4D0DC] hover:bg-[#F1F5F9] hover:shadow-md hover:shadow-slate-400/10 dark:hover:border-slate-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#EEF2F6] text-[#475569] ring-1 ring-[#D5DEE8]/60 dark:bg-slate-700/70 dark:text-slate-300 dark:ring-slate-500/35',
      }
    case 'consumable':
      return {
        label: 'Consumables',
        stripeClass: 'border-l-[#D4A017] dark:border-l-yellow-400',
        boxClass:
          'border-[#F5E6B8]/80 bg-[#FFFBF0]/95 dark:border-yellow-500/25 dark:bg-slate-800/75',
        hoverClass:
          'hover:border-[#EFD996] hover:bg-[#FFF8E8] hover:shadow-md hover:shadow-[#D4A017]/10 dark:hover:border-yellow-400/35 dark:hover:bg-slate-700/80 dark:hover:shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
        pillClass:
          'bg-[#FEF3D6] text-[#9A7209] ring-1 ring-[#F5E6B8]/60 dark:bg-yellow-950/50 dark:text-yellow-300 dark:ring-yellow-500/30',
      }
  }
}

function getTimelineTitle(activity: DashboardRecentActivity): string {
  switch (activity.type) {
    case 'worker':
      return `${activity.title} added`
    case 'vehicle':
      return `${activity.title} added`
    case 'availability':
      if (activity.title.includes(' — ')) {
        const [registration, status] = activity.title.split(' — ')
        return `${registration} scheduled ${status}`
      }
      return activity.title
    case 'holiday_request':
      switch (activity.variant) {
        case 'approved':
          return `${activity.title} holiday approved`
        case 'declined':
          return `${activity.title} holiday declined`
        default:
          return `${activity.title} requested holiday`
      }
    case 'timesheet':
      return activity.variant === 'approved'
        ? `${activity.title} timesheet approved`
        : `${activity.title} submitted timesheet`
    case 'vehicle_check':
      if (activity.severity === 'danger') {
        return `${activity.title} vehicle check failed`
      }
      if (activity.severity === 'warning') {
        return `${activity.title} completed vehicle check — issue found`
      }
      return `${activity.title} completed vehicle check`
    case 'driver_report':
      return activity.variant === 'in_progress'
        ? `${activity.reportTitle} moved to In Progress`
        : `${activity.title} created Driver Report`
    case 'document':
      return activity.documentName
        ? `${activity.documentName} uploaded`
        : 'Document uploaded'
    case 'consumable':
      if (activity.consumableType === 'Consumable') {
        return 'Consumable recorded'
      }
      return `${activity.title} recorded ${activity.consumableType} for ${activity.vehicleReg}`
  }
}

function RecentActivityItem({
  item,
  formatRelativeDateTime,
}: {
  item: DashboardRecentActivity
  formatRelativeDateTime: (iso: string) => string
}) {
  const navigate = useNavigate()
  const route = item.path ?? getDashboardActivityRoute(item)
  const accent = getActivityAccent(item)
  const isClickable = Boolean(route)

  const itemClassName = [
    'relative z-[1] w-full rounded-xl border border-l-[3px] px-3.5 py-2.5 text-left shadow-sm transition-all duration-200',
    accent.stripeClass,
    accent.boxClass,
    isClickable
      ? `cursor-pointer select-none hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/50 focus-visible:ring-offset-1 ${accent.hoverClass}`
      : '',
  ].join(' ')

  const content = (
    <>
      <span
        className={`mb-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${accent.pillClass}`}
      >
        {accent.label}
      </span>
      <p className="text-sm font-bold leading-snug text-[#163A63] dark:text-slate-100">{getTimelineTitle(item)}</p>
      <p className="mt-1 text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
        {formatRelativeDateTime(item.createdAt)}
      </p>
    </>
  )

  function openActivityRoute() {
    if (!route) return
    navigate(route)
  }

  if (isClickable) {
    return (
      <li className="relative z-[1] list-none">
        <button
          type="button"
          className={itemClassName}
          onClick={openActivityRoute}
        >
          {content}
        </button>
      </li>
    )
  }

  return <li className={`${itemClassName} list-none`}>{content}</li>
}

function RecentActivityPanel({
  activity,
  isLoading,
}: {
  activity: DashboardRecentActivity[]
  isLoading: boolean
}) {
  const { formatRelativeDateTime } = useCompanySettings()

  if (isLoading) {
    return <RecentActivitySkeleton />
  }

  return (
    <section
      className={`${dashboardOverviewCardStaticClass} flex min-h-0 flex-col transition-shadow duration-[200ms] ease-out sm:min-h-[360px] md:hover:shadow-[0_12px_28px_rgba(30,64,175,0.12)] xl:min-h-[520px] xl:sticky xl:top-6`}
    >
      <div className={`shrink-0 border-b ${dashboardOverviewDividerClass} pb-4`}>
        <h3 className={dashboardOverviewCardTitleClass}>Recent Activity</h3>
        <p className={dashboardOverviewCardSubtitleClass}>
          Latest changes across your operation
        </p>
      </div>

      <div className="relative z-[1] mt-4 min-h-0 flex-1 max-md:overflow-visible xl:overflow-y-auto xl:max-h-[calc(100dvh-14rem)] xl:pr-1">
        {activity.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#D2E5F5] bg-[#F8FBFF]/70 px-4 py-10 text-center dark:border-white/10 dark:bg-slate-800/40">
            <p className="text-sm font-medium text-[#5D7C9D] dark:text-slate-400">No recent activity yet.</p>
          </div>
        ) : (
          <ul className="relative z-[1] space-y-2.5">
            {activity.map((item) => (
              <RecentActivityItem
                key={`${item.type}-${item.id}`}
                item={item}
                formatRelativeDateTime={formatRelativeDateTime}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function getVehicleChecksKpiProps(
  checks: {
    completedToday: number
    issuesToday: number
  },
  options?: { warningSeen?: boolean },
) {
  const { completedToday, issuesToday } = checks
  const warningSeen = options?.warningSeen ?? false

  if (completedToday === 0 && issuesToday === 0) {
    return {
      value: 0,
      accent: 'neutral' as const,
      helper: 'No checks today',
      issueCount: 0,
      showIssueBadge: false,
      helperTone: 'default' as const,
    }
  }

  if (issuesToday > 0) {
    return {
      value: completedToday,
      accent: 'danger' as const,
      helper: warningSeen
        ? `${issuesToday} issue${issuesToday === 1 ? '' : 's'} found · viewed`
        : `${issuesToday} issue${issuesToday === 1 ? '' : 's'} found`,
      issueCount: issuesToday,
      showIssueBadge: !warningSeen,
      helperTone: warningSeen ? ('default' as const) : ('danger' as const),
    }
  }

  return {
    value: completedToday,
    accent: 'green' as const,
    helper: 'Completed today',
    issueCount: 0,
    showIssueBadge: false,
    helperTone: 'default' as const,
  }
}

export function DashboardOverview({
  stats,
  loading,
}: {
  stats: DashboardStats
  loading: DashboardLoadingState
}) {
  const { settings, timezone } = useCompanySettings()
  const { session } = useAuth()
  const [vehicleCheckWarningSeenVersion, setVehicleCheckWarningSeenVersion] = useState(0)
  const companyToday = getCompanyTodayIsoDate(timezone)

  const showVehicleCheckWarningBadge = useMemo(
    () =>
      shouldShowVehicleCheckWarningBadge({
        companyId: settings?.id,
        userId: session?.user.id,
        todayDate: companyToday,
        issueCount: stats.vehicleChecksToday.issuesToday,
        latestIssueAt: stats.vehicleChecksToday.latestIssueAt,
      }),
    [
      settings?.id,
      session?.user.id,
      companyToday,
      stats.vehicleChecksToday.issuesToday,
      stats.vehicleChecksToday.latestIssueAt,
      vehicleCheckWarningSeenVersion,
    ],
  )

  const handleVehicleChecksNavigate = useCallback(() => {
    const { issuesToday, latestIssueAt } = stats.vehicleChecksToday
    if (issuesToday <= 0) return

    markVehicleCheckWarningSeen({
      companyId: settings?.id,
      userId: session?.user.id,
      todayDate: companyToday,
      issueCount: issuesToday,
      latestIssueAt,
    })
    setVehicleCheckWarningSeenVersion((version) => version + 1)
  }, [settings?.id, session?.user.id, stats.vehicleChecksToday, companyToday])

  const availablePercent = useMemo(
    () => (stats.vehicles > 0 ? (stats.availableVehicles / stats.vehicles) * 100 : undefined),
    [stats.availableVehicles, stats.vehicles],
  )

  const workingPercent = useMemo(
    () => (stats.workers > 0 ? (stats.workingToday / stats.workers) * 100 : undefined),
    [stats.workers, stats.workingToday],
  )

  const vehicleChecksKpi = useMemo(
    () =>
      getVehicleChecksKpiProps(stats.vehicleChecksToday, {
        warningSeen:
          stats.vehicleChecksToday.issuesToday > 0 && !showVehicleCheckWarningBadge,
      }),
    [stats.vehicleChecksToday, showVehicleCheckWarningBadge],
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="dashboard-kpi-grid grid min-w-0 grid-cols-2 gap-x-2 gap-y-6 overflow-visible pt-3 pb-2 sm:gap-x-5 sm:gap-y-6 sm:pt-4 sm:pb-0 xl:grid-cols-4 xl:gap-6">
        {loading.kpis ? (
          Array.from({ length: 4 }).map((_, index) => <DashboardKpiSkeleton key={index} />)
        ) : (
          <>
            <DashboardKpiCard
              title="Active Vehicles"
              value={stats.availableVehicles}
              helper="Available today"
              icon={Truck}
              to="/vehicles"
              accent="blue"
              ringPercent={availablePercent}
            />
            <DashboardKpiCard
              title="Workers"
              value={stats.workingToday}
              helper="Working status today"
              icon={Users}
              to="/drivers"
              accent="cyan"
              ringPercent={workingPercent}
            />
            <DashboardKpiCard
              title="Vehicle Checks"
              value={vehicleChecksKpi.value}
              helper={vehicleChecksKpi.helper}
              icon={ClipboardCheck}
              to="/admin/vehicle-checks"
              accent={vehicleChecksKpi.accent}
              issueCount={vehicleChecksKpi.issueCount}
              showIssueBadge={vehicleChecksKpi.showIssueBadge}
              helperTone={vehicleChecksKpi.helperTone}
              onNavigate={handleVehicleChecksNavigate}
            />
            <DashboardKpiCard
              title="Open Reports"
              value={stats.driverReports.open}
              helper="Driver reports awaiting action"
              icon={FileBarChart}
              to="/admin/driver-reports"
              accent="warning"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 overflow-visible sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {loading.timesheet ? (
              <DashboardOverviewCardSkeleton />
            ) : (
              <TimesheetOverviewCard overview={stats.timesheetOverview} />
            )}
            {loading.holidays ? (
              <DashboardOverviewCardSkeleton />
            ) : (
              <HolidayRequestsOverviewCard summary={stats.holidayRequests} />
            )}
            {loading.driverReports ? (
              <DashboardOverviewCardSkeleton />
            ) : (
              <DriverReportsOverviewCard summary={stats.driverReports} />
            )}
            {loading.fleetStatus ? (
              <DashboardOverviewCardSkeleton />
            ) : (
              <FleetStatusOverviewCard fleetStatus={stats.fleetStatus} />
            )}
            {loading.vehicleChecks ? (
              <DashboardOverviewCardSkeleton />
            ) : (
              <DailyVehicleChecksStatsCard stats={stats.dailyVehicleChecksStats} />
            )}
            {loading.consumables ? (
              <DashboardOverviewCardSkeleton />
            ) : (
              <ConsumablesOverviewCard overview={stats.consumablesOverview} />
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 overflow-visible sm:gap-6">
          <NotesPlansCard />
          <RecentActivityPanel activity={stats.recentActivity} isLoading={loading.recentActivity} />
        </div>
      </div>
    </div>
  )
}

export function DashboardOnboardingCard() {
  return (
    <div className={`${dashboardOverviewCardStaticClass} px-6 py-12 text-center`}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#DCEEFF] text-[#3B82F6] ring-1 ring-[#CFE3F5] dark:bg-slate-800 dark:text-blue-300 dark:ring-white/10">
        <Users className="size-7" strokeWidth={2} />
      </div>
      <p className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#163A63] dark:text-slate-100">
        Welcome to DREVORA
      </p>
      <p className="mt-2 text-sm text-[#5D7C9D] dark:text-slate-400">
        Add workers and vehicles to unlock your operations dashboard.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/drivers"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#3B82F6] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#2563EB]"
        >
          Add Worker
        </Link>
        <Link
          to="/vehicles"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CFE3F5] bg-white px-4 text-sm font-semibold text-[#3B82F6] hover:bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/80"
        >
          Add Vehicle
        </Link>
      </div>
    </div>
  )
}
