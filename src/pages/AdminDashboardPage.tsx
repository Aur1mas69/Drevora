import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FleetOperationsHeader } from '@/components/dashboard/FleetOperationsHeader'
import { useFleetOperationsHeader } from '@/hooks/useFleetOperationsHeader'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import AdminLayout from '@/layouts/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Plus,
  Shield,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
import {
  dashboardService,
  emptyDashboardStats,
  type DashboardRecentActivity,
  type DashboardStats,
} from '@/services/dashboardService'

const glassCard =
  'rounded-[20px] border border-white/80 bg-white/95 shadow-[0_24px_64px_rgba(59,130,246,0.11)] ring-1 ring-blue-100/70 backdrop-blur-sm'

const hoverLift =
  'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_28px_72px_rgba(59,130,246,0.14)]'

const fleetKpiCardBase =
  'overflow-hidden rounded-[13px] border border-[rgba(75,120,220,0.10)] shadow-[0_8px_24px_rgba(40,80,140,0.05)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(40,80,140,0.09)]'

const fleetOverviewPanel =
  'overflow-hidden rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-[#EAF2FF]/70 p-2 shadow-[0_8px_24px_rgba(40,80,140,0.05)]'

function getOperationsStatus(stats: DashboardStats): {
  message: string
  tone: 'green' | 'orange' | 'red'
} {
  const { complianceAlerts, availabilityAlerts, offRoadOrOutOfService } = stats
  const needsAction =
    complianceAlerts > 0 ||
    availabilityAlerts.offRoadToday > 0 ||
    offRoadOrOutOfService > 0

  const hasUpcoming =
    availabilityAlerts.goingOffRoadSoon > 0 ||
    availabilityAlerts.documentsExpiringSoon > 0 ||
    availabilityAlerts.maintenanceToday > 0 ||
    availabilityAlerts.outOfServiceToday > 0

  if (needsAction) {
    return { message: 'Action required on fleet or compliance', tone: 'red' }
  }
  if (hasUpcoming) {
    return { message: 'Upcoming events need review', tone: 'orange' }
  }
  return { message: 'Everything operating normally', tone: 'green' }
}

function getTimelineTitle(activity: DashboardRecentActivity): string {
  switch (activity.type) {
    case 'worker':
      return `${activity.title} created`
    case 'vehicle':
      return `${activity.title} created`
    case 'availability':
      if (activity.title.includes(' — ')) {
        const [registration, status] = activity.title.split(' — ')
        return `${registration} scheduled ${status}`
      }
      return `${activity.title} scheduled`
  }
}

function getTimelineDotClass(activity: DashboardRecentActivity): string {
  switch (activity.type) {
    case 'worker':
      return 'bg-[#3B82F6]'
    case 'vehicle':
      return 'bg-[#2563EB]'
    case 'availability':
      return 'bg-amber-500'
  }
}

function StatusDot({ tone }: { tone: 'green' | 'orange' | 'red' }) {
  const colors = {
    green: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]',
    orange: 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]',
    red: 'bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.18)]',
  }
  return <span className={`inline-block size-2 shrink-0 rounded-full ${colors[tone]}`} />
}

function DashboardSection({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-slate-950 sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  to,
  ariaLabel,
  badgeClass = 'from-[#DBEAFE] to-[#BFDBFE] text-[#2563EB]',
  surfaceClass = 'bg-[#EEF4FF]',
}: {
  label: string
  value: number
  detail: string
  icon: typeof Users
  to?: string
  ariaLabel?: string
  badgeClass?: string
  surfaceClass?: string
}) {
  const content = (
    <CardContent className="px-3.5 py-3 sm:px-4 sm:py-3.5">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${badgeClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]`}
        >
          <Icon className="size-4" strokeWidth={1.85} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[2rem] font-semibold leading-none tracking-[-0.05em] text-[#2A376F]">
            {value}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.07em] text-slate-500">
            {label}
          </p>
          <p className="sr-only">{detail}</p>
        </div>
        {to ? (
          <ArrowUpRight
            className="size-3.5 shrink-0 text-[#2563EB] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
            aria-hidden="true"
          />
        ) : null}
      </div>
    </CardContent>
  )

  const cardClassName = `${fleetKpiCardBase} ${surfaceClass} border-0 py-0 ring-0`

  if (to) {
    return (
      <Link
        to={to}
        aria-label={ariaLabel ?? `View ${label}`}
        className="group block cursor-pointer"
      >
        <Card className={cardClassName}>{content}</Card>
      </Link>
    )
  }

  return <Card className={`group ${cardClassName}`}>{content}</Card>
}

function LiveStatusStrip({ stats }: { stats: DashboardStats }) {
  const status = getOperationsStatus(stats)
  const fleetLabel =
    status.tone === 'green'
      ? 'Fleet Healthy'
      : status.tone === 'orange'
        ? 'Fleet Attention Needed'
        : 'Fleet Action Required'

  const items: { label: string; tone: 'green' | 'orange' | 'red' | 'neutral' }[] = [
    { label: fleetLabel, tone: status.tone },
    {
      label: `${stats.availableVehicles} Vehicle${stats.availableVehicles === 1 ? '' : 's'} Available`,
      tone: stats.availableVehicles > 0 ? 'green' : 'neutral',
    },
  ]

  if (stats.availabilityAlerts.maintenanceToday > 0) {
    items.push({
      label: `${stats.availabilityAlerts.maintenanceToday} Vehicle${stats.availabilityAlerts.maintenanceToday === 1 ? '' : 's'} in Maintenance today`,
      tone: 'orange',
    })
  }

  if (stats.availabilityAlerts.goingOffRoadSoon > 0) {
    items.push({
      label: `${stats.availabilityAlerts.goingOffRoadSoon} Vehicle${stats.availabilityAlerts.goingOffRoadSoon === 1 ? '' : 's'} going Off Road soon`,
      tone: 'orange',
    })
  }

  if (stats.complianceAlerts === 0) {
    items.push({ label: 'No Compliance Issues', tone: 'green' })
  } else {
    items.push({
      label: `${stats.complianceAlerts} Compliance Issue${stats.complianceAlerts === 1 ? '' : 's'}`,
      tone: 'red',
    })
  }

  const toneStyles = {
    green: 'bg-emerald-50/90 text-emerald-800 ring-emerald-100',
    orange: 'bg-amber-50/90 text-amber-800 ring-amber-100',
    red: 'bg-rose-50/90 text-rose-800 ring-rose-100',
    neutral: 'bg-white/90 text-slate-700 ring-blue-100',
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2.5">
        {items.map((item) => (
          <div
            key={item.label}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ring-1 backdrop-blur-sm ${toneStyles[item.tone]}`}
          >
            <StatusDot
              tone={
                item.tone === 'neutral'
                  ? 'green'
                  : item.tone
              }
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function VehicleAlertStatusCard({
  title,
  count,
  unit,
  accent,
  icon: Icon,
  to,
}: {
  title: string
  count: number
  unit: string
  accent: string
  icon: typeof AlertTriangle
  to: string
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col justify-between rounded-[18px] border border-[rgba(222,222,222,0.9)] bg-gradient-to-br from-white to-[#F8FBFF] p-5 ring-1 ring-blue-100/70 ${hoverLift}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-10 items-center justify-center rounded-[14px] ring-1 ${accent}`}>
          <Icon className="size-4" strokeWidth={1.9} />
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          View
          <ArrowRight className="size-3.5" />
        </span>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.06em] text-slate-950">
          {count}{' '}
          <span className="w-[66px] text-base font-medium tracking-normal text-[#4B535D]">{unit}</span>
        </p>
      </div>
    </Link>
  )
}

const vehicleAlertsGridCard =
  'rounded-[20px] border border-white/80 bg-white/95 shadow-[0_0_0_0.93px_rgba(0,0,0,0.15),0_24px_64px_rgba(59,130,246,0.11)] backdrop-blur-sm'

function VehicleAlertsGrid({ alerts }: { alerts: DashboardStats['availabilityAlerts'] }) {
  return (
    <div className={`${vehicleAlertsGridCard} p-5 sm:p-6`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <VehicleAlertStatusCard
          title="Off Road Today"
          count={alerts.offRoadToday}
          unit="Vehicles"
          accent="bg-rose-50 text-rose-600 ring-rose-100"
          icon={AlertTriangle}
          to="/vehicles"
        />
        <VehicleAlertStatusCard
          title="Maintenance Today"
          count={alerts.maintenanceToday}
          unit="Vehicles"
          accent="bg-amber-50 text-amber-700 ring-amber-100"
          icon={Wrench}
          to="/vehicles"
        />
        <VehicleAlertStatusCard
          title="Going Off Road Soon"
          count={alerts.goingOffRoadSoon}
          unit="Vehicles"
          accent="bg-orange-50 text-orange-700 ring-orange-100"
          icon={CalendarClock}
          to="/vehicles"
        />
        <VehicleAlertStatusCard
          title="Documents Expiring Soon"
          count={alerts.documentsExpiringSoon}
          unit="Vehicles"
          accent="bg-[#EAF4FF] text-[#2563EB] ring-blue-100"
          icon={Shield}
          to="/compliance"
        />
      </div>
    </div>
  )
}

function ActivityTimeline({ activity }: { activity: DashboardRecentActivity[] }) {
  const { formatRelativeDateTime } = useCompanySettings()

  return (
    <div className={`${glassCard} p-6 sm:p-7`}>
      {activity.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-[16px] bg-gradient-to-br from-[#F8FBFF] to-white ring-1 ring-blue-100/60">
          <p className="text-sm font-semibold text-slate-500">No recent activity yet.</p>
        </div>
      ) : (
        <ul className="space-y-0">
          {activity.map((item, index) => (
            <li key={`${item.type}-${item.id}`}>
              <div className="flex gap-4 py-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${getTimelineDotClass(item)} ring-4 ring-white`}
                  />
                  {index < activity.length - 1 ? (
                    <div className="mt-2 w-px flex-1 bg-gradient-to-b from-blue-200/70 to-transparent" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <p className="text-sm font-semibold leading-6 text-slate-800">
                    {getTimelineTitle(item)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    {formatRelativeDateTime(item.createdAt)}
                  </p>
                </div>
              </div>
              {index < activity.length - 1 ? (
                <div
                  aria-hidden="true"
                  className="ml-[4.5px] h-px w-[calc(100%-1.125rem)] bg-gradient-to-r from-blue-100/80 via-blue-50/40 to-transparent"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuickActionCard({
  label,
  icon: Icon,
  to,
  gradient,
}: {
  label: string
  icon: typeof Plus | typeof Shield | typeof Truck
  to: string
  gradient: string
}) {
  return (
    <Link
      to={to}
      className={`group flex flex-col items-start rounded-[20px] border border-white/80 bg-white/95 p-6 ring-1 ring-blue-100/70 ${hoverLift}`}
    >
      <div
        className={`flex size-14 items-center justify-center rounded-[18px] bg-gradient-to-br ${gradient} text-white shadow-[0_14px_32px_rgba(59,130,246,0.18)] ring-1 ring-white/40 transition-transform duration-200 ease-out group-hover:scale-[1.02]`}
      >
        <Icon className="size-6" strokeWidth={1.85} />
      </div>
      <p className="mt-5 text-base font-semibold tracking-[-0.02em] text-slate-900">
        {label}
      </p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Open
        <ChevronRight className="size-3.5" />
      </span>
    </Link>
  )
}

function OperationsPanel({
  stats,
  activity,
}: {
  stats: DashboardStats
  activity: DashboardRecentActivity[]
}) {
  const vehicleEvents = activity.filter((item) => item.type === 'availability').slice(0, 4)

  const panelSections = [
    {
      title: "Today's Summary",
      items: [
        `${stats.workingToday} worker${stats.workingToday === 1 ? '' : 's'} working today`,
        `${stats.availableVehicles} vehicle${stats.availableVehicles === 1 ? '' : 's'} available`,
        `${stats.offRoadOrOutOfService} unavailable today`,
        `${stats.availabilityAlerts.maintenanceToday} in maintenance today`,
      ],
    },
    {
      title: 'Upcoming Vehicle Events',
      items:
        vehicleEvents.length > 0
          ? vehicleEvents.map((item) => getTimelineTitle(item))
          : stats.availabilityAlerts.goingOffRoadSoon > 0
            ? [
                `${stats.availabilityAlerts.goingOffRoadSoon} vehicle${stats.availabilityAlerts.goingOffRoadSoon === 1 ? '' : 's'} going Off Road soon`,
              ]
            : ['No upcoming vehicle events recorded'],
    },
    {
      title: 'Upcoming Compliance Expiry',
      items:
        stats.complianceAlerts > 0
          ? [
              `${stats.complianceAlerts} compliance item${stats.complianceAlerts === 1 ? '' : 's'} need attention`,
            ]
          : stats.availabilityAlerts.documentsExpiringSoon > 0
            ? [
                `${stats.availabilityAlerts.documentsExpiringSoon} vehicle${stats.availabilityAlerts.documentsExpiringSoon === 1 ? '' : 's'} with documents expiring soon`,
              ]
            : ['No compliance expiry alerts'],
    },
    {
      title: 'Upcoming Maintenance',
      items:
        stats.availabilityAlerts.maintenanceToday > 0 ||
        stats.availabilityAlerts.goingOffRoadSoon > 0
          ? [
              ...(stats.availabilityAlerts.maintenanceToday > 0
                ? [
                    `${stats.availabilityAlerts.maintenanceToday} vehicle${stats.availabilityAlerts.maintenanceToday === 1 ? '' : 's'} in maintenance today`,
                  ]
                : []),
              ...(stats.availabilityAlerts.goingOffRoadSoon > 0
                ? [
                    `${stats.availabilityAlerts.goingOffRoadSoon} vehicle${stats.availabilityAlerts.goingOffRoadSoon === 1 ? '' : 's'} scheduled Off Road soon`,
                  ]
                : []),
            ]
          : ['No maintenance events scheduled'],
    },
  ]

  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <div className={`${glassCard} overflow-hidden`}>
        <div className="border-b border-blue-100/70 bg-gradient-to-r from-[#F8FBFF] to-white px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3B82F6]">
            Operations
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
            Live Panel
          </h3>
        </div>
        <div className="divide-y divide-blue-50/80 p-5">
          {panelSections.map((section) => (
            <div key={section.title} className="py-4 first:pt-0 last:pb-0">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                {section.title}
              </p>
              <ul className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm font-medium leading-5 text-slate-600"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#93C5FD]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className={fleetOverviewPanel}>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[72px] animate-pulse rounded-[13px] border border-[rgba(75,120,220,0.10)] bg-[#EEF4FF]/80"
            />
          ))}
        </div>
      </div>
      <div className={`${glassCard} h-14 animate-pulse bg-white/80`} />
    </div>
  )
}

function OnboardingCard() {
  return (
    <div className={`${glassCard} px-6 py-14 text-center sm:px-10`}>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#EAF4FF] to-[#DCEEFF] text-[#3B82F6] ring-1 ring-blue-100">
        <Users className="size-8" strokeWidth={1.9} />
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
        Welcome to DREVORA
      </p>
      <p className="mt-2 text-sm font-medium text-slate-500">
        Set up your company operations to unlock the command centre.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Button
          asChild
          className="h-11 rounded-[16px] bg-[#3B82F6] px-5 font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.22)]"
        >
          <Link to="/drivers">
            <Plus className="size-4" />
            Add Worker
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-[16px] border-0 bg-white px-5 font-semibold ring-1 ring-blue-100"
        >
          <Link to="/vehicles">
            <Plus className="size-4" />
            Add Vehicle
          </Link>
        </Button>
      </div>
    </div>
  )
}

function AdminDashboardPage() {
  const fleetHeader = useFleetOperationsHeader()
  const [stats, setStats] = useState<DashboardStats>(emptyDashboardStats)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false
    async function load() {
      setIsLoading(true)
      const result = await dashboardService.fetchDashboardStats()
      if (!isCancelled) {
        setStats(result)
        setIsLoading(false)
      }
    }
    void load()
    return () => {
      isCancelled = true
    }
  }, [])

  const isEmptyWorkspace = stats.workers === 0 && stats.vehicles === 0

  const kpis = useMemo(
    () => [
      {
        label: 'Workers',
        value: stats.workers,
        detail: 'Total worker records',
        icon: Users,
        to: '/drivers',
        ariaLabel: `View all ${stats.workers} workers`,
        badgeClass: 'from-[#DBEAFE] to-[#BFDBFE] text-[#2563EB]',
        surfaceClass: 'bg-[#EEF4FF]',
      },
      {
        label: 'Working Today',
        value: stats.workingToday,
        detail: 'Status set to Working',
        icon: CheckCircle2,
        to: '/drivers?status=Working',
        ariaLabel: `View ${stats.workingToday} workers working today`,
        badgeClass: 'from-[#D1FAE5] to-[#A7F3D0] text-[#059669]',
        surfaceClass: 'bg-[#EAF2FF]',
      },
      {
        label: 'Vehicles',
        value: stats.vehicles,
        detail: 'Total fleet records',
        icon: Truck,
        to: '/vehicles',
        ariaLabel: `View all ${stats.vehicles} vehicles`,
        badgeClass: 'from-[#DBEAFE] to-[#BFDBFE] text-[#2563EB]',
        surfaceClass: 'bg-[#E8F1FF]',
      },
      {
        label: 'Available',
        value: stats.availableVehicles,
        detail: 'Available today',
        icon: Truck,
        to: '/vehicles?status=Available',
        ariaLabel: `View ${stats.availableVehicles} available vehicles`,
        badgeClass: 'from-[#D1FAE5] to-[#A7F3D0] text-[#059669]',
        surfaceClass: 'bg-[#EEF4FF]',
      },
      {
        label: 'Off Road / OOS',
        value: stats.offRoadOrOutOfService,
        detail: 'Unavailable today',
        icon: AlertTriangle,
        to: '/vehicles?status=Unavailable',
        ariaLabel: `View ${stats.offRoadOrOutOfService} unavailable vehicles`,
        badgeClass: 'from-[#FEF3C7] to-[#FDE68A] text-[#D97706]',
        surfaceClass: 'bg-[#EAF2FF]',
      },
      {
        label: 'Compliance',
        value: stats.complianceAlerts,
        detail: 'Expired or expiring soon',
        icon: Shield,
        to: '/compliance',
        ariaLabel: `View ${stats.complianceAlerts} compliance alerts`,
        badgeClass: 'from-[#EDE9FE] to-[#DDD6FE] text-[#7C3AED]',
        surfaceClass: 'bg-[#E8F1FF]',
      },
    ],
    [stats],
  )

  return (
    <AdminLayout
      premiumBackground
      wideContent
      customHeader={<FleetOperationsHeader {...fleetHeader} />}
    >
      <div className="space-y-8">
        {isLoading ? <DashboardSkeleton /> : null}

        {!isLoading && isEmptyWorkspace ? <OnboardingCard /> : null}

        {!isLoading && !isEmptyWorkspace ? (
          <>
            <DashboardSection
              title="Fleet Overview"
              subtitle="Real-time metrics across your operation."
            >
              <div className={fleetOverviewPanel}>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                  {kpis.map((kpi) => (
                    <KpiCard key={kpi.label} {...kpi} />
                  ))}
                </div>
              </div>
            </DashboardSection>

            <LiveStatusStrip stats={stats} />

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-8">
                <DashboardSection
                  title="Vehicle Alerts"
                  subtitle="Status cards for today's fleet risks."
                  action={
                    <Button
                      asChild
                      variant="outline"
                      className="h-9 rounded-[12px] border-0 bg-white/90 px-3.5 text-sm font-semibold ring-1 ring-blue-100"
                    >
                      <Link to="/vehicles">View fleet</Link>
                    </Button>
                  }
                >
                  <VehicleAlertsGrid alerts={stats.availabilityAlerts} />
                </DashboardSection>

                <DashboardSection
                  title="Recent Activity"
                  subtitle="Latest operational changes across the fleet."
                >
                  <ActivityTimeline activity={stats.recentActivity} />
                </DashboardSection>

                <DashboardSection
                  title="Quick Actions"
                  subtitle="Common tasks for fleet managers."
                >
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <QuickActionCard
                      label="Add Worker"
                      icon={Plus}
                      to="/drivers"
                      gradient="from-[#3B82F6] to-[#2563EB]"
                    />
                    <QuickActionCard
                      label="Add Vehicle"
                      icon={Plus}
                      to="/vehicles"
                      gradient="from-[#60A5FA] to-[#3B82F6]"
                    />
                    <QuickActionCard
                      label="Compliance"
                      icon={Shield}
                      to="/compliance"
                      gradient="from-[#93C5FD] to-[#60A5FA]"
                    />
                    <QuickActionCard
                      label="Fleet"
                      icon={Truck}
                      to="/vehicles"
                      gradient="from-[#BFDBFE] to-[#93C5FD]"
                    />
                  </div>
                </DashboardSection>
              </div>

              <OperationsPanel stats={stats} activity={stats.recentActivity} />
            </div>
          </>
        ) : null}

        {!isLoading && isEmptyWorkspace ? (
          <DashboardSection title="Quick Actions" subtitle="Get started with your fleet.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <QuickActionCard
                label="Add Worker"
                icon={Plus}
                to="/drivers"
                gradient="from-[#3B82F6] to-[#2563EB]"
              />
              <QuickActionCard
                label="Add Vehicle"
                icon={Plus}
                to="/vehicles"
                gradient="from-[#60A5FA] to-[#3B82F6]"
              />
              <QuickActionCard
                label="Compliance"
                icon={Shield}
                to="/compliance"
                gradient="from-[#93C5FD] to-[#60A5FA]"
              />
              <QuickActionCard
                label="Fleet"
                icon={Truck}
                to="/vehicles"
                gradient="from-[#BFDBFE] to-[#93C5FD]"
              />
            </div>
          </DashboardSection>
        ) : null}
      </div>
    </AdminLayout>
  )
}

export default AdminDashboardPage
