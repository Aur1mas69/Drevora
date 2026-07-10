import { ConsumablesOverviewCard } from '@/components/dashboard/ConsumablesOverviewCard'
import { DailyVehicleChecksStatsCard } from '@/components/dashboard/DailyVehicleChecksStatsCard'
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard'
import { DriverReportsOverviewCard } from '@/components/dashboard/DriverReportsOverviewCard'
import { FleetStatusOverviewCard } from '@/components/dashboard/FleetStatusOverviewCard'
import { HolidayRequestsOverviewCard } from '@/components/dashboard/HolidayRequestsOverviewCard'
import { NotesPlansCard } from '@/components/dashboard/NotesPlansCard'
import { TimesheetOverviewCard } from '@/components/dashboard/TimesheetOverviewCard'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
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

const cardClass =
  'rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF]/95 to-[#EEF6FF]/90 shadow-sm shadow-[#BDDDFB]/25'

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
        stripeClass: 'border-l-[#218EE7]',
        boxClass: 'border-[#C5DFFB]/80 bg-[#F5FAFF]/95',
        hoverClass:
          'hover:border-[#A8D4F7] hover:bg-[#EFF7FF] hover:shadow-md hover:shadow-[#218EE7]/10',
        pillClass: 'bg-[#E8F3FE] text-[#0B68BE] ring-1 ring-[#C5DFFB]/50',
      }
    case 'vehicle':
      return {
        label: 'Vehicle',
        stripeClass: 'border-l-[#2BB8D4]',
        boxClass: 'border-[#B8EBF5]/80 bg-[#F2FCFE]/95',
        hoverClass:
          'hover:border-[#9FE0EF] hover:bg-[#EAF9FC] hover:shadow-md hover:shadow-[#2BB8D4]/10',
        pillClass: 'bg-[#E6F9FC] text-[#0E8FA8] ring-1 ring-[#B8EBF5]/50',
      }
    case 'availability':
      if (isAvailabilityWarningStatus(activity.title)) {
        return {
          label: 'Fleet',
          stripeClass: 'border-l-[#E8843A]',
          boxClass: 'border-[#FFDCC8]/80 bg-[#FFF8F3]/95',
          hoverClass:
            'hover:border-[#FFCFAF] hover:bg-[#FFF3EB] hover:shadow-md hover:shadow-[#E8843A]/10',
          pillClass: 'bg-[#FFEDE3] text-[#C65A12] ring-1 ring-[#FFDCC8]/60',
        }
      }
      return {
        label: 'Vehicle',
        stripeClass: 'border-l-[#2BB8D4]',
        boxClass: 'border-[#B8EBF5]/80 bg-[#F2FCFE]/95',
        hoverClass:
          'hover:border-[#9FE0EF] hover:bg-[#EAF9FC] hover:shadow-md hover:shadow-[#2BB8D4]/10',
        pillClass: 'bg-[#E6F9FC] text-[#0E8FA8] ring-1 ring-[#B8EBF5]/50',
      }
    case 'holiday_request':
      return {
        label: 'Holiday',
        stripeClass: 'border-l-[#A855C8]',
        boxClass: 'border-[#E9D5FF]/80 bg-[#FAF5FF]/95',
        hoverClass:
          'hover:border-[#DCC4F5] hover:bg-[#F5EDFF] hover:shadow-md hover:shadow-[#A855C8]/10',
        pillClass: 'bg-[#F3E8FF] text-[#7E3FA8] ring-1 ring-[#E9D5FF]/60',
      }
    case 'timesheet':
      return {
        label: 'Timesheet',
        stripeClass: 'border-l-[#22A861]',
        boxClass: 'border-[#BBEAD0]/80 bg-[#F3FBF6]/95',
        hoverClass:
          'hover:border-[#A3DFC0] hover:bg-[#EBF8F0] hover:shadow-md hover:shadow-[#22A861]/10',
        pillClass: 'bg-[#E3F6EA] text-[#1A7A45] ring-1 ring-[#BBEAD0]/60',
      }
    case 'vehicle_check':
      if (activity.severity === 'danger') {
        return {
          label: 'Check Failed',
          stripeClass: 'border-l-[#DC2626]',
          boxClass: 'border-[#FECACA]/80 bg-[#FFF1F2]/95',
          hoverClass:
            'hover:border-[#FCA5A5] hover:bg-[#FFE4E6] hover:shadow-md hover:shadow-[#DC2626]/10',
          pillClass: 'bg-[#FFE4E6] text-[#BE123C] ring-1 ring-[#FECACA]/60',
        }
      }
      if (activity.severity === 'warning') {
        return {
          label: 'Check Issue',
          stripeClass: 'border-l-[#EA580C]',
          boxClass: 'border-[#FED7AA]/80 bg-[#FFF7ED]/95',
          hoverClass:
            'hover:border-[#FDBA74] hover:bg-[#FFEDD5] hover:shadow-md hover:shadow-[#EA580C]/10',
          pillClass: 'bg-[#FFEDD5] text-[#C2410C] ring-1 ring-[#FED7AA]/60',
        }
      }
      return {
        label: 'Vehicle Check',
        stripeClass: 'border-l-[#14A89E]',
        boxClass: 'border-[#B8EBE8]/80 bg-[#F0FAFA]/95',
        hoverClass:
          'hover:border-[#9FE0DC] hover:bg-[#E8F7F6] hover:shadow-md hover:shadow-[#14A89E]/10',
        pillClass: 'bg-[#E0F5F3] text-[#0F7A72] ring-1 ring-[#B8EBE8]/60',
      }
    case 'driver_report':
      return {
        label: 'Driver Report',
        stripeClass: 'border-l-[#F08A24]',
        boxClass: 'border-[#FFDDB8]/80 bg-[#FFF9F3]/95',
        hoverClass:
          'hover:border-[#FFD0A0] hover:bg-[#FFF4EA] hover:shadow-md hover:shadow-[#F08A24]/10',
        pillClass: 'bg-[#FFEDD5] text-[#C45F08] ring-1 ring-[#FFDDB8]/60',
      }
    case 'document':
      return {
        label: 'Document',
        stripeClass: 'border-l-[#64748B]',
        boxClass: 'border-[#D5DEE8]/80 bg-[#F8FAFC]/95',
        hoverClass:
          'hover:border-[#C4D0DC] hover:bg-[#F1F5F9] hover:shadow-md hover:shadow-slate-400/10',
        pillClass: 'bg-[#EEF2F6] text-[#475569] ring-1 ring-[#D5DEE8]/60',
      }
    case 'consumable':
      return {
        label: 'Consumables',
        stripeClass: 'border-l-[#D4A017]',
        boxClass: 'border-[#F5E6B8]/80 bg-[#FFFBF0]/95',
        hoverClass:
          'hover:border-[#EFD996] hover:bg-[#FFF8E8] hover:shadow-md hover:shadow-[#D4A017]/10',
        pillClass: 'bg-[#FEF3D6] text-[#9A7209] ring-1 ring-[#F5E6B8]/60',
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
      <p className="text-sm font-bold leading-snug text-[#113C69]">{getTimelineTitle(item)}</p>
      <p className="mt-1 text-xs font-medium text-[#5499BF]">
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

function RecentActivityPanel({ activity }: { activity: DashboardRecentActivity[] }) {
  const { formatRelativeDateTime } = useCompanySettings()

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border-[3px] border-[#38bdf8] bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_0_0_1px_rgba(56,189,248,0.22),0_4px_18px_rgba(56,189,248,0.14),0_16px_42px_rgba(33,142,231,0.16)] ring-1 ring-[#BAE6FD]/60 transition-all duration-300 max-md:shadow-[0_0_0_1px_rgba(56,189,248,0.18),0_4px_14px_rgba(56,189,248,0.1)] sm:min-h-[360px] sm:p-6 md:hover:-translate-y-0.5 md:hover:border-[#0ea5e9] md:hover:shadow-[0_0_0_1px_rgba(14,165,233,0.32),0_8px_24px_rgba(56,189,248,0.18),0_22px_48px_rgba(33,142,231,0.22)] xl:min-h-[520px] xl:sticky xl:top-6">
      <div className="shrink-0 border-b border-[#D3E9FC] pb-4">
        <h3 className="text-base font-bold tracking-[-0.02em] text-[#113C69]">Recent Activity</h3>
        <p className="mt-1 text-xs leading-5 text-[#3D7A9C]">
          Latest changes across your operation
        </p>
      </div>

      <div className="relative z-[1] mt-4 min-h-0 flex-1 max-md:overflow-visible xl:overflow-y-auto xl:max-h-[calc(100dvh-14rem)] xl:pr-1">
        {activity.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#D3E9FC] bg-white/70 px-4 py-10 text-center">
            <p className="text-sm font-medium text-[#3D7A9C]">No recent activity yet.</p>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="dashboard-kpi-grid grid min-w-0 grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-5 sm:gap-y-6 xl:grid-cols-4 xl:gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="mx-auto flex w-full min-w-0 max-w-full flex-col items-center">
            <div className="aspect-square w-full max-w-[clamp(6.75rem,34vw,8.75rem)] animate-pulse rounded-full border-2 border-[#D3E9FC] bg-[#E8F3FE]/60 sm:max-w-[11.75rem] lg:max-w-[12.25rem]" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[#E8F3FE]/60" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className={`${cardClass} h-44 animate-pulse bg-[#E8F3FE]/60`} />
            ))}
          </div>
          <div className={`${cardClass} h-56 animate-pulse bg-[#E8F3FE]/60`} />
        </div>
        <div className={`${cardClass} min-h-[520px] animate-pulse bg-[#E8F3FE]/60`} />
      </div>
    </div>
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
  isLoading,
}: {
  stats: DashboardStats
  isLoading: boolean
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

  if (isLoading) {
    return <DashboardSkeleton />
  }

  const availablePercent =
    stats.vehicles > 0 ? (stats.availableVehicles / stats.vehicles) * 100 : undefined
  const workingPercent =
    stats.workers > 0 ? (stats.workingToday / stats.workers) * 100 : undefined
  const vehicleChecksKpi = getVehicleChecksKpiProps(stats.vehicleChecksToday, {
    warningSeen:
      stats.vehicleChecksToday.issuesToday > 0 && !showVehicleCheckWarningBadge,
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="dashboard-kpi-grid grid min-w-0 grid-cols-2 gap-x-2 gap-y-6 pb-2 sm:gap-x-5 sm:gap-y-6 sm:pb-0 xl:grid-cols-4 xl:gap-6">
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            <TimesheetOverviewCard overview={stats.timesheetOverview} />
            <HolidayRequestsOverviewCard summary={stats.holidayRequests} />
            <DriverReportsOverviewCard summary={stats.driverReports} />
            <FleetStatusOverviewCard fleetStatus={stats.fleetStatus} />
            <DailyVehicleChecksStatsCard stats={stats.dailyVehicleChecksStats} />
            <ConsumablesOverviewCard overview={stats.consumablesOverview} />
          </div>

          <NotesPlansCard />
        </div>

        <RecentActivityPanel activity={stats.recentActivity} />
      </div>
    </div>
  )
}

export function DashboardPageHeader() {
  return (
    <div className="mb-4 sm:mb-6">
      <h1 className="text-xl font-semibold tracking-[-0.04em] text-[#113C69] sm:text-[1.65rem]">
        Dashboard
      </h1>
      <p className="mt-1.5 text-xs leading-5 text-[#3D7A9C] sm:mt-1 sm:text-sm">
        Overview of your fleet, workers and daily operations.
      </p>
    </div>
  )
}

export function DashboardOnboardingCard() {
  return (
    <div className={`${cardClass} px-6 py-12 text-center`}>
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#E8F3FE] text-[#218EE7] ring-1 ring-[#D3E9FC]">
        <Users className="size-7" strokeWidth={2} />
      </div>
      <p className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#113C69]">
        Welcome to DREVORA
      </p>
      <p className="mt-2 text-sm text-[#3D7A9C]">
        Add workers and vehicles to unlock your operations dashboard.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/drivers"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#218EE7] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#0B68BE]"
        >
          Add Worker
        </Link>
        <Link
          to="/vehicles"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#D3E9FC] bg-white px-4 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF]"
        >
          Add Vehicle
        </Link>
      </div>
    </div>
  )
}
