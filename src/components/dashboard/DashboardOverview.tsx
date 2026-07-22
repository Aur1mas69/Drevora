import { ConsumablesOverviewCard } from '@/components/dashboard/ConsumablesOverviewCard'
import { DailyVehicleChecksStatsCard } from '@/components/dashboard/DailyVehicleChecksStatsCard'
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard'
import {
  DashboardKpiSkeleton,
  DashboardOverviewCardSkeleton,
  RecentActivitySkeleton,
} from '@/components/dashboard/DashboardOverviewSkeletons'
import { DriverReportsOverviewCard } from '@/components/dashboard/DriverReportsOverviewCard'
import { FleetComplianceAlertsCard } from '@/components/dashboard/FleetComplianceAlertsCard'
import { FleetStatusOverviewCard } from '@/components/dashboard/FleetStatusOverviewCard'
import { HolidayRequestsOverviewCard } from '@/components/dashboard/HolidayRequestsOverviewCard'
import { NotesPlansCard } from '@/components/dashboard/NotesPlansCard'
import { TimesheetOverviewCard } from '@/components/dashboard/TimesheetOverviewCard'
import { TyreChecksOverviewCard } from '@/components/dashboard/TyreChecksOverviewCard'
import { dashboardOverviewCardStaticClass } from '@/components/dashboard/dashboardOverviewCardStyles'
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
  /** Soft tinted card surface */
  surfaceClass: string
  /** Soft left accent glow */
  accentBarClass: string
  /** Refined type pill */
  pillClass: string
  /** Soft hover lift / glow */
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
        accentBarClass: 'bg-[#3B82F6]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(248,251,255,0.98)_0%,rgba(220,238,255,0.55)_100%)] shadow-[0_2px_10px_rgba(59,130,246,0.07)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(59,130,246,0.14)]',
        pillClass: 'bg-[#DCEEFF]/90 text-[#2563EB]',
      }
    case 'vehicle':
      return {
        label: 'Vehicle',
        accentBarClass: 'bg-[#06B6D4]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(242,252,254,0.98)_0%,rgba(186,230,253,0.45)_100%)] shadow-[0_2px_10px_rgba(6,182,212,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(6,182,212,0.16)]',
        pillClass: 'bg-[#E0F7FA]/95 text-[#0E7490]',
      }
    case 'availability':
      if (isAvailabilityWarningStatus(activity.title)) {
        return {
          label: 'Fleet',
          accentBarClass: 'bg-[#F97316]',
          surfaceClass:
            'bg-[linear-gradient(135deg,rgba(255,248,243,0.98)_0%,rgba(255,237,213,0.55)_100%)] shadow-[0_2px_10px_rgba(249,115,22,0.08)]',
          hoverClass:
            'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(249,115,22,0.14)]',
          pillClass: 'bg-[#FFEDD5]/95 text-[#C2410C]',
        }
      }
      return {
        label: 'Vehicle',
        accentBarClass: 'bg-[#06B6D4]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(242,252,254,0.98)_0%,rgba(186,230,253,0.45)_100%)] shadow-[0_2px_10px_rgba(6,182,212,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(6,182,212,0.16)]',
        pillClass: 'bg-[#E0F7FA]/95 text-[#0E7490]',
      }
    case 'holiday_request':
      return {
        label: 'Holiday',
        accentBarClass: 'bg-[#A855F7]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(250,245,255,0.98)_0%,rgba(243,232,255,0.55)_100%)] shadow-[0_2px_10px_rgba(168,85,247,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(168,85,247,0.14)]',
        pillClass: 'bg-[#F3E8FF]/95 text-[#7E22CE]',
      }
    case 'timesheet':
      return {
        label: 'Timesheet',
        accentBarClass: 'bg-[#22C55E]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(243,251,246,0.98)_0%,rgba(220,252,231,0.5)_100%)] shadow-[0_2px_10px_rgba(34,197,94,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(34,197,94,0.14)]',
        pillClass: 'bg-[#DCFCE7]/95 text-[#15803D]',
      }
    case 'vehicle_check':
      if (activity.severity === 'danger') {
        return {
          label: 'Check Failed',
          accentBarClass: 'bg-[#EF4444]',
          surfaceClass:
            'bg-[linear-gradient(135deg,rgba(255,241,242,0.98)_0%,rgba(254,226,226,0.55)_100%)] shadow-[0_2px_10px_rgba(239,68,68,0.08)]',
          hoverClass:
            'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(239,68,68,0.14)]',
          pillClass: 'bg-[#FFE4E6]/95 text-[#BE123C]',
        }
      }
      if (activity.severity === 'warning') {
        return {
          label: 'Check Issue',
          accentBarClass: 'bg-[#F97316]',
          surfaceClass:
            'bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(255,237,213,0.55)_100%)] shadow-[0_2px_10px_rgba(249,115,22,0.08)]',
          hoverClass:
            'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(249,115,22,0.14)]',
          pillClass: 'bg-[#FFEDD5]/95 text-[#C2410C]',
        }
      }
      return {
        label: 'Vehicle Check',
        accentBarClass: 'bg-[#14B8A6]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(240,250,250,0.98)_0%,rgba(204,251,241,0.5)_100%)] shadow-[0_2px_10px_rgba(20,184,166,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(20,184,166,0.14)]',
        pillClass: 'bg-[#CCFBF1]/95 text-[#0F766E]',
      }
    case 'driver_report':
      return {
        label: 'Driver Report',
        accentBarClass: 'bg-[#F59E0B]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(255,249,243,0.98)_0%,rgba(254,243,199,0.5)_100%)] shadow-[0_2px_10px_rgba(245,158,11,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(245,158,11,0.14)]',
        pillClass: 'bg-[#FEF3C7]/95 text-[#B45309]',
      }
    case 'document':
      return {
        label: 'Document',
        accentBarClass: 'bg-[#64748B]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(248,250,252,0.98)_0%,rgba(241,245,249,0.7)_100%)] shadow-[0_2px_10px_rgba(100,116,139,0.07)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(100,116,139,0.12)]',
        pillClass: 'bg-[#F1F5F9]/95 text-[#475569]',
      }
    case 'consumable':
      return {
        label: 'Consumables',
        accentBarClass: 'bg-[#D97706]',
        surfaceClass:
          'bg-[linear-gradient(135deg,rgba(255,251,240,0.98)_0%,rgba(254,243,199,0.5)_100%)] shadow-[0_2px_10px_rgba(217,119,6,0.08)]',
        hoverClass:
          'md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_20px_rgba(217,119,6,0.14)]',
        pillClass: 'bg-[#FEF3C7]/95 text-[#B45309]',
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
    'group relative w-full overflow-hidden rounded-2xl px-3.5 py-2.5 text-left transition-all duration-200 ease-out motion-reduce:transition-none',
    accent.surfaceClass,
    isClickable
      ? `cursor-pointer select-none active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/40 focus-visible:ring-offset-1 ${accent.hoverClass}`
      : '',
  ].join(' ')

  const content = (
    <>
      <span
        className={`pointer-events-none absolute inset-y-2.5 left-0 w-[3px] rounded-full ${accent.accentBarClass} opacity-80 shadow-[0_0_8px_rgba(56,189,248,0.25)]`}
        aria-hidden="true"
      />
      <div className="pl-2.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${accent.pillClass}`}
        >
          {accent.label}
        </span>
        <p className="mt-1.5 truncate text-[13px] font-semibold leading-snug tracking-[-0.01em] text-[#163A63] dark:text-slate-100">
          {getTimelineTitle(item)}
        </p>
        <p className="mt-1 text-[11px] font-medium leading-none text-[#7A97B5] dark:text-slate-400">
          {formatRelativeDateTime(item.createdAt)}
        </p>
      </div>
    </>
  )

  function openActivityRoute() {
    if (!route) return
    navigate(route)
  }

  if (isClickable) {
    return (
      <li className="list-none">
        <button type="button" className={itemClassName} onClick={openActivityRoute}>
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
    <section className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#8EC8F0]/55 bg-[linear-gradient(165deg,#D7EDFF_0%,#E8F4FF_28%,#F2F8FF_62%,#DEEEFF_100%)] p-4 shadow-[0_14px_36px_rgba(37,99,235,0.16),0_4px_12px_rgba(56,189,248,0.1),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm sm:p-5 dark:border-sky-700/40 dark:bg-[linear-gradient(165deg,#0B1F36_0%,#12263F_48%,#0F1D30_100%)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Frosted glass overlay — keeps the panel tinted, not flat white */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.06)_42%,rgba(186,230,253,0.18)_100%)] dark:bg-[linear-gradient(180deg,rgba(56,189,248,0.08)_0%,transparent_50%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-[#38BDF8]/35 blur-3xl dark:bg-sky-400/15"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-[#60A5FA]/30 blur-3xl dark:bg-blue-500/12"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-sky-300/25"
        aria-hidden="true"
      />

      <div className="relative mb-4 border-b border-[#A8D4F5]/55 pb-3.5 dark:border-sky-800/50">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-[-0.03em] text-[#0F2F54] dark:text-slate-50 sm:text-base">
            Recent Activity
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.09em] text-emerald-700 shadow-[0_1px_4px_rgba(16,185,129,0.12)] ring-1 ring-emerald-200/70 backdrop-blur-sm dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-700/50">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#4A7399] dark:text-slate-400 sm:text-[13px]">
          Live operations feed
        </p>
      </div>

      {activity.length === 0 ? (
        <div className="relative mt-auto rounded-2xl bg-white/45 px-3 py-6 text-center shadow-[inset_0_0_0_1px_rgba(142,200,240,0.45)] backdrop-blur-sm dark:bg-slate-900/40 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
          <p className="text-xs font-medium text-[#5D7C9D] dark:text-slate-400">
            No recent activity yet.
          </p>
        </div>
      ) : (
        <ul className="relative min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-0.5 xl:min-h-0">
          {activity.map((item) => (
            <RecentActivityItem
              key={`${item.type}-${item.id}`}
              item={item}
              formatRelativeDateTime={formatRelativeDateTime}
            />
          ))}
        </ul>
      )}
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

      {/*
        Desktop right column: Notes on top, Recent Activity immediately below
        (spans the full height of fleet + consumables/tyre rows).
      */}
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
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
        <div className="flex min-w-0 flex-col gap-3 sm:col-span-2 xl:col-span-1 xl:row-span-3">
          <NotesPlansCard />
          <div className="min-h-0 min-w-0 flex-1 [&_>_*]:h-full">
            <RecentActivityPanel
              activity={stats.recentActivity}
              isLoading={loading.recentActivity}
            />
          </div>
        </div>
        {loading.fleetStatus ? (
          <DashboardOverviewCardSkeleton />
        ) : (
          <FleetStatusOverviewCard fleetStatus={stats.fleetStatus} />
        )}
        {loading.fleetStatus ? (
          <DashboardOverviewCardSkeleton />
        ) : (
          <FleetComplianceAlertsCard summary={stats.fleetComplianceAlerts} />
        )}
        {loading.vehicleChecks ? (
          <DashboardOverviewCardSkeleton />
        ) : (
          <DailyVehicleChecksStatsCard stats={stats.dailyVehicleChecksStats} />
        )}
        <div className="min-w-0 xl:col-span-2 [&_>_*]:h-full">
          {loading.consumables ? (
            <DashboardOverviewCardSkeleton />
          ) : (
            <ConsumablesOverviewCard overview={stats.consumablesOverview} />
          )}
        </div>
        <div className="min-w-0 [&_>_*]:h-full">
          {loading.tyreChecks ? (
            <DashboardOverviewCardSkeleton />
          ) : (
            <TyreChecksOverviewCard stats={stats.dailyTyreChecksStats} />
          )}
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
