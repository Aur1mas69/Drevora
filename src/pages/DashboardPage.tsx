import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { WorkerHomeDefaultVehicleSheet } from '@/components/worker/WorkerHomeDefaultVehicleSheet'
import { WorkerHomeRoadBackground } from '@/components/worker/WorkerHomeRoadBackground'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { getSentenceTimeGreeting, resolveGreetingFullName } from '@/lib/greeting'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import { readNativeOfflineMembershipSnapshot } from '@/lib/nativeOfflineMembership'
import {
  OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE,
  readWorkerOfflineBootstrap,
  warmWorkerOfflineBootstrap,
} from '@/lib/workerOfflineBootstrap'
import { getWorkerHomeQuickActionItems } from '@/lib/workerNavigation'
import {
  formatWorkerHomeStatusDetail,
  previousTimesheetWeekStart,
  resolveWorkerHomeTimesheetStatus,
  resolveWorkerHomeVehicleCheckStatus,
  type WorkerHomeStatusTone,
} from '@/lib/workerHomeStatus'
import {
  formatLocalDateString,
  getDefaultWeekStartMonday,
} from '@/lib/timesheetUtils'
import { cn } from '@/lib/utils'
import {
  DriversServiceError,
  setWorkerDefaultVehicle,
} from '@/services/driversService'
import { fetchTimesheetForDriverWeek } from '@/services/timesheetsService'
import { fetchVehicleChecks } from '@/services/vehicleChecksService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import {
  ChevronRight,
  MoonStar,
  ShieldCheck,
  Sun,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Tight crop of the Worker robot only (transparent WebP, no banner/road). */
const WORKER_ROBOT_SRC = '/assets/worker/drevora-worker-robot-only.webp'
const WORKER_ROBOT_WIDTH = 1264
const WORKER_ROBOT_HEIGHT = 975

function getGreetingPeriodIcon(date = new Date()): LucideIcon {
  const hour = date.getHours()
  // Morning + afternoon: sun. Evening + night: moon.
  if (hour >= 5 && hour < 17) return Sun
  return MoonStar
}

function resetHorizontalScrollOffset() {
  const scrollingElement = document.scrollingElement
  if (scrollingElement) {
    scrollingElement.scrollLeft = 0
  }
  document.documentElement.scrollLeft = 0
  document.body.scrollLeft = 0
  window.scrollTo(0, window.scrollY || window.pageYOffset || 0)
}


function statusDotClass(tone: WorkerHomeStatusTone): string {
  if (tone === 'green') return 'worker-home-status-dot--green'
  if (tone === 'amber') return 'worker-home-status-dot--amber'
  return 'worker-home-status-dot--red'
}

function WorkerHomeHeader({ workerName }: { workerName: string | null }) {
  const headerRef = useRef<HTMLElement>(null)
  const GreetingIcon = getGreetingPeriodIcon()
  const greeting = getSentenceTimeGreeting()

  useLayoutEffect(() => {
    // iOS PWA cold launch can keep a non-zero horizontal scroll offset (or a
    // briefly over-wide content box) from the first layout pass, which clips
    // only this left-aligned greeting until a manual refresh.
    const syncHeaderPosition = () => {
      resetHorizontalScrollOffset()
      const node = headerRef.current
      if (!node) return
      const { left } = node.getBoundingClientRect()
      if (left < 0) {
        resetHorizontalScrollOffset()
      }
    }

    syncHeaderPosition()

    let cancelled = false
    const fontsReady = document.fonts?.ready
    if (fontsReady) {
      void fontsReady.then(() => {
        if (!cancelled) syncHeaderPosition()
      })
    }

    window.addEventListener('pageshow', syncHeaderPosition)
    window.visualViewport?.addEventListener('resize', syncHeaderPosition)

    return () => {
      cancelled = true
      window.removeEventListener('pageshow', syncHeaderPosition)
      window.visualViewport?.removeEventListener('resize', syncHeaderPosition)
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className="worker-home-header flex w-full min-w-0 max-w-full items-center gap-3.5"
    >
      <div className="worker-home-greeting-icon" aria-hidden>
        <GreetingIcon className="size-8" strokeWidth={2} />
      </div>
      <div className="worker-home-greeting-text min-w-0 flex-1">
        <h1 className="worker-home-greeting-script max-w-full break-words">
          {greeting}
        </h1>
        {workerName ? (
          <p className="worker-home-greeting-company max-w-full break-words">
            {workerName}
          </p>
        ) : (
          <div
            className="h-5 w-40 max-w-full animate-pulse rounded-full bg-[color:var(--worker-border)]"
            aria-hidden
          />
        )}
      </div>
    </header>
  )
}

/**
 * Premium hero on Worker Home (Light + Dark).
 *
 * Layer model (do not merge):
 * 1) Banner shell — fixed min-height, overflow hidden, rounded corners; road/dark fill only.
 * 2) Left copy — in-flow over the banner; never sized by the robot.
 * 3) Robot — absolute bottom-right sibling of the shell (not inside overflow:hidden),
 *    so only the head may peek above the rounded box.
 */
function WorkerHomeRobotHero({ isDark }: { isDark: boolean }) {
  return (
    <section className="worker-home-hero relative isolate pt-5 sm:pt-6">
      {/* Height comes only from the banner shell — not from the robot. */}
      <div className="relative min-h-[5.75rem] min-[380px]:min-h-[7.75rem] sm:min-h-[9.75rem] lg:min-h-[12.25rem]">
        {/* Clipped banner surface (road / dark). Robot is NOT a child here. */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 z-0 overflow-hidden rounded-[1.75rem]',
            isDark ? 'worker-robot-hero' : null,
          )}
        >
          {!isDark ? (
            <>
              <WorkerHomeRoadBackground className="pointer-events-none absolute inset-0 z-0 h-full w-full max-w-none" />
              <div
                className="pointer-events-none absolute inset-0 z-[1]"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(247, 251, 255, 0.38) 0%, rgba(235, 246, 255, 0.18) 28%, rgba(235, 246, 255, 0.04) 52%, transparent 72%)',
                }}
              />
            </>
          ) : null}
        </div>

        {/* Left text — top-aligned so copy clears the road/truck detail at the bottom. */}
        <div className="relative z-[2] flex h-full min-h-[5.75rem] max-w-[58%] flex-col justify-start space-y-1 px-4 pt-3.5 pb-3 min-[380px]:min-h-[7.75rem] min-[380px]:max-w-[55%] min-[380px]:pt-4 sm:min-h-[9.75rem] sm:max-w-[52%] sm:space-y-1.5 sm:px-5 sm:pt-5 sm:pb-4 lg:min-h-[12.25rem] lg:max-w-[50%] lg:pt-6">
          <h2
            className={cn(
              'break-words text-lg font-bold leading-[1.2] tracking-tight min-[380px]:text-xl sm:text-2xl [font-weight:700]',
              isDark ? 'text-white' : 'text-[#0B1F3A]',
            )}
          >
            Ready for the road?
          </h2>
          <p
            className={cn(
              'max-w-[14rem] break-words text-xs leading-snug min-[380px]:max-w-[16rem] min-[380px]:text-sm sm:max-w-[18rem]',
              isDark ? 'text-white/70' : 'text-[#3D5A80]',
            )}
          >
            Check your vehicle and start with confidence.
          </p>
        </div>

        {/* Absolute robot: feet on banner bottom; head may overflow above the rounded shell. */}
        <div
          className="worker-robot-hero__figure pointer-events-none absolute bottom-0 right-0 z-[3] w-[9.5rem] select-none min-[380px]:w-[12rem] sm:w-[14.5rem] lg:w-[17.5rem]"
          aria-hidden="true"
        >
          <img
            src={WORKER_ROBOT_SRC}
            alt=""
            width={WORKER_ROBOT_WIDTH}
            height={WORKER_ROBOT_HEIGHT}
            loading="eager"
            decoding="async"
            draggable={false}
            className="worker-robot-hero__body"
          />
        </div>
      </div>
    </section>
  )
}

function DashboardPage() {
  const { session } = useAuth()
  const { worker, isLoading, error, reload: reloadWorker } = useCurrentWorker()
  const { companyId, companyLoading, settings } = useCompanySettings()
  const isDark = useIsWorkerDarkMode()
  const [isOnline, setIsOnline] = useState(true)
  const [offlinePrepared, setOfflinePrepared] = useState<boolean | null>(null)

  const [vehicleCheckStatus, setVehicleCheckStatus] = useState(() =>
    resolveWorkerHomeVehicleCheckStatus({
      todayLocalDate: formatLocalDateString(new Date()),
      completedChecks: [],
    }),
  )
  const [timesheetStatus, setTimesheetStatus] = useState(() =>
    resolveWorkerHomeTimesheetStatus({
      currentWeek: null,
      previousWeek: null,
    }),
  )
  const [statusLoading, setStatusLoading] = useState(true)

  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([])
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false)
  const [isSavingDefaultVehicle, setIsSavingDefaultVehicle] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const greetingWorkerName = worker
    ? resolveGreetingFullName(worker.firstName, worker.lastName)
    : isLoading
      ? null
      : 'Worker'

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null)
      toastTimerRef.current = null
    }, 2800)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => Promise<void>) | null = null

    void getOnlineStatus().then((online) => {
      if (!cancelled) setIsOnline(online)
    })
    void addOnlineStatusListener((online) => {
      if (!cancelled) setIsOnline(online)
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => handle.remove()
    })

    return () => {
      cancelled = true
      if (removeListener) void removeListener()
    }
  }, [])

  // After a successful online Worker Home load, warm the shared offline bootstrap.
  useEffect(() => {
    const userId = session?.user.id?.trim()
    if (!worker || !userId || isLoading || companyLoading) return

    let cancelled = false
    void (async () => {
      const online = await getOnlineStatus()
      if (!online || cancelled) return

      let warmCompanyId = companyId?.trim() || null
      if (!warmCompanyId) {
        const snap = await readNativeOfflineMembershipSnapshot(userId)
        warmCompanyId = snap?.companyId?.trim() || null
      }
      if (!warmCompanyId) return

      try {
        // Persist worker shell immediately so offline Home can restore default vehicle
        // even if the fleet fetch is slow or cancelled by an effect re-run.
        await warmWorkerOfflineBootstrap({
          userId,
          companyId: warmCompanyId,
          worker,
          vehicles: [],
          skipOnlineCheck: true,
        })
        if (cancelled) return

        const vehicles = await fetchVehicles()
        if (cancelled) return
        await warmWorkerOfflineBootstrap({
          userId,
          companyId: warmCompanyId,
          worker,
          vehicles,
          skipOnlineCheck: true,
        })
        if (!cancelled) setOfflinePrepared(true)
      } catch {
        // Best-effort — online Home must not fail if warm fails.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [companyId, companyLoading, isLoading, session?.user.id, worker])

  // Offline cold start: know whether Vehicle Check data was prepared previously.
  useEffect(() => {
    const userId = session?.user.id?.trim()
    if (!userId || isOnline) {
      if (isOnline) setOfflinePrepared(null)
      return
    }

    let cancelled = false
    // Same readiness rule as Vehicle Checks: a cache without vehicles cannot
    // start an offline walkaround, so Home must show the prepare message.
    void readWorkerOfflineBootstrap(userId, companyId).then((cache) => {
      if (!cancelled) setOfflinePrepared(cache != null && cache.vehicles.length > 0)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isOnline, session?.user.id, worker])

  // Load Vehicle Check + Timesheet status for the compact Home status card.
  useEffect(() => {
    if (!isOnline || !worker?.id || isLoading || companyLoading) {
      if (!isOnline) setStatusLoading(false)
      return
    }

    let cancelled = false
    setStatusLoading(true)

    void (async () => {
      const todayLocalDate = formatLocalDateString(new Date())
      const weekSettings = {
        timesheetWeekStartDay: settings?.timesheetWeekStartDay ?? 'monday',
      } as const
      const currentWeekStart = getDefaultWeekStartMonday(weekSettings)
      const previousWeekStart = previousTimesheetWeekStart(currentWeekStart)

      try {
        const [checksPage, currentTimesheet, previousTimesheet] =
          await Promise.all([
            fetchVehicleChecks({
              workerId: worker.id,
              status: 'Completed',
              page: 1,
              pageSize: 20,
            }),
            fetchTimesheetForDriverWeek(worker.id, currentWeekStart),
            fetchTimesheetForDriverWeek(worker.id, previousWeekStart),
          ])

        if (cancelled) return

        const completedChecks = checksPage.items
          .filter((item) => item.status === 'Completed')
          .map((item) => ({
            inspectionDate: item.inspectionDate,
            signedAt: item.signedAt,
            inspectionCompletedAt: item.inspectionCompletedAt,
          }))

        setVehicleCheckStatus(
          resolveWorkerHomeVehicleCheckStatus({
            todayLocalDate,
            completedChecks,
          }),
        )
        setTimesheetStatus(
          resolveWorkerHomeTimesheetStatus({
            currentWeek: currentTimesheet
              ? {
                  status: currentTimesheet.status,
                  submittedAt: currentTimesheet.submittedAt,
                  updatedAt: currentTimesheet.updatedAt,
                }
              : null,
            previousWeek: previousTimesheet
              ? {
                  status: previousTimesheet.status,
                  submittedAt: previousTimesheet.submittedAt,
                  updatedAt: previousTimesheet.updatedAt,
                }
              : null,
          }),
        )
      } catch {
        if (!cancelled) {
          // Keep conservative defaults (not completed / in progress) — do not fabricate green.
          setVehicleCheckStatus(
            resolveWorkerHomeVehicleCheckStatus({
              todayLocalDate,
              completedChecks: [],
            }),
          )
          setTimesheetStatus(
            resolveWorkerHomeTimesheetStatus({
              currentWeek: null,
              previousWeek: null,
            }),
          )
        }
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    companyLoading,
    isLoading,
    isOnline,
    settings?.timesheetWeekStartDay,
    worker?.id,
  ])

  // Prefetch active company vehicles for the default-vehicle sheet.
  useEffect(() => {
    if (!isOnline || !worker || isLoading || companyLoading) return

    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchVehicles({ lifecycle: 'active' })
        if (!cancelled) setFleetVehicles(rows)
      } catch {
        if (!cancelled) setFleetVehicles([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [companyLoading, isLoading, isOnline, worker])

  async function handleSelectDefaultVehicle(vehicle: Vehicle) {
    if (vehicle.id === worker?.defaultVehicleId) {
      setVehicleSheetOpen(false)
      return
    }

    const registration = vehicle.registration?.trim() || 'No registration'
    setIsSavingDefaultVehicle(true)
    try {
      await setWorkerDefaultVehicle(vehicle.id)
      reloadWorker()
      setVehicleSheetOpen(false)
      showToast(`Default vehicle changed to ${registration}`)
    } catch (saveError) {
      // Keep sheet open and previous selection — do not optimistically flip.
      showToast(
        saveError instanceof DriversServiceError
          ? saveError.message
          : saveError instanceof Error && saveError.message.trim()
            ? saveError.message
            : 'Unable to change default vehicle.',
      )
    } finally {
      setIsSavingDefaultVehicle(false)
    }
  }

  // Online: keep hard-fail when profile is missing.
  // Offline: always render Home shell + CTA (cached profile preferred).
  if (!isLoading && (error || !worker) && isOnline) {
    return (
      <div className="worker-card rounded-[1.75rem] p-5">
        <h1 className="text-lg font-semibold text-[color:var(--worker-text)]">Worker profile</h1>
        <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
          {error ??
            'We could not find a worker profile linked to your account. Please contact your manager.'}
        </p>
      </div>
    )
  }

  const defaultVehicleLabel =
    worker?.defaultVehicleRegistration?.trim() ||
    worker?.assignment?.trim() ||
    null

  // Exactly 4 Quick actions cards (Timesheets, Holiday Requests, Vehicles,
  // Documents), same route/permission source, in both Light and Dark.
  // Contacts/Settings live only in the bottom nav; Sign out is bottom-nav only.
  const quickActionItems = getWorkerHomeQuickActionItems()
  const showOfflineNotPrepared =
    !isOnline && offlinePrepared === false

  const vehicleCheckDetail = formatWorkerHomeStatusDetail(
    vehicleCheckStatus.detailAt,
  )
  const timesheetDetail = formatWorkerHomeStatusDetail(timesheetStatus.detailAt)

  const startVehicleCheckCta = (
    <Link
      to="/worker/vehicle-checks"
      className={cn(
        'worker-home-cta',
        isDark ? 'worker-cta-gradient text-white' : 'worker-btn-primary',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <ShieldCheck className="size-5 shrink-0 opacity-95" strokeWidth={1.75} aria-hidden />
        <span className="truncate">Start Vehicle Check</span>
      </span>
      <ChevronRight className="size-5 shrink-0 opacity-90" aria-hidden />
    </Link>
  )

  // Offline: never gate on live Worker/company loading — those requests cannot
  // settle. Keep the greeting (offline banner is global), drop every live card
  // and Quick Actions, and always expose the cached Vehicle Check entry point.
  if (!isOnline) {
    return (
      <div className="worker-home-stack mx-auto box-border w-full min-w-0 max-w-md overflow-x-clip lg:max-w-3xl">
        <WorkerHomeHeader workerName={greetingWorkerName} />

        {showOfflineNotPrepared ? (
          <div
            role="status"
            className="worker-home-surface px-4 py-3.5 text-sm text-[color:var(--worker-text-secondary)]"
          >
            {OFFLINE_VEHICLE_CHECKS_NOT_PREPARED_MESSAGE}
          </div>
        ) : null}

        {startVehicleCheckCta}
      </div>
    )
  }

  return (
    <div className="worker-home-stack mx-auto box-border w-full min-w-0 max-w-md overflow-x-clip lg:max-w-3xl">
      <WorkerHomeHeader workerName={greetingWorkerName} />

      {isLoading || companyLoading ? (
        <div
          className="min-h-[40vh] rounded-[1.75rem] bg-[color:var(--worker-card)]"
          aria-label="Loading worker home"
          role="status"
        />
      ) : (
        <>
          <WorkerHomeRobotHero isDark={isDark} />

          <div className="worker-home-status-vehicle-row grid grid-cols-2 items-stretch gap-2.5">
            <button
              type="button"
              onClick={() => setVehicleSheetOpen(true)}
              className="worker-home-default-vehicle worker-home-default-vehicle--compact flex h-full min-w-0 items-center gap-2 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)]"
              aria-haspopup="dialog"
              aria-expanded={vehicleSheetOpen}
            >
              <div className="worker-home-icon-well worker-home-icon-well--compact">
                <Truck className="size-6" strokeWidth={2.25} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'worker-home-dv-label text-[9px] font-medium uppercase tracking-[0.12em]',
                    !isDark && 'text-[color:var(--worker-text-muted)]',
                  )}
                >
                  Default vehicle
                </p>
                <p
                  className={cn(
                    'worker-home-dv-value mt-0.5 truncate text-[17px] font-bold leading-tight tracking-wide',
                    !isDark && 'text-[color:var(--worker-text)]',
                  )}
                >
                  {defaultVehicleLabel ?? 'Not set'}
                </p>
              </div>
              <ChevronRight className="worker-home-chevron size-4 shrink-0" aria-hidden />
            </button>

            <section
              className="worker-home-status-card flex h-full min-w-0 flex-col justify-center gap-2.5 px-3 py-3"
              aria-label="Worker status"
              aria-busy={statusLoading}
            >
              <Link
                to="/worker/vehicle-checks"
                className="worker-home-status-row flex min-w-0 items-start gap-2 rounded-xl text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)]"
              >
                <span
                  className={cn(
                    'worker-home-status-dot mt-1 shrink-0',
                    statusDotClass(vehicleCheckStatus.tone),
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                    Vehicle Check
                  </span>
                  <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-[color:var(--worker-text)]">
                    {vehicleCheckStatus.title}
                  </span>
                  {vehicleCheckDetail ? (
                    <span className="mt-0.5 block truncate text-[10px] leading-snug text-[color:var(--worker-text-secondary)]">
                      {vehicleCheckDetail}
                    </span>
                  ) : null}
                </span>
              </Link>

              <div className="worker-home-status-row flex min-w-0 items-start gap-2">
                <span
                  className={cn(
                    'worker-home-status-dot mt-1 shrink-0',
                    statusDotClass(timesheetStatus.tone),
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                    Timesheet
                  </span>
                  <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-[color:var(--worker-text)]">
                    {timesheetStatus.title}
                  </span>
                  {timesheetDetail ? (
                    <span className="mt-0.5 block truncate text-[10px] leading-snug text-[color:var(--worker-text-secondary)]">
                      {timesheetDetail}
                    </span>
                  ) : null}
                </span>
              </div>
            </section>
          </div>

          <section className="worker-home-quick-actions">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--worker-text-muted)]">
              Quick actions
            </h2>
            <div className="worker-home-quick-actions-grid grid grid-cols-2 gap-3">
              {quickActionItems.map((item, index) => {
                const Icon = item.icon
                const accentClass = isDark
                  ? index % 2 === 0
                    ? 'worker-quick-action-mint'
                    : 'worker-quick-action-indigo'
                  : null
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={cn('worker-home-quick-action', accentClass)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="worker-home-icon-well">
                        <Icon className="size-6" strokeWidth={2.25} aria-hidden />
                      </div>
                      <ChevronRight className="worker-home-chevron mt-0.5" aria-hidden />
                    </div>
                    <p
                      className={cn(
                        'worker-home-qa-label text-[15px] font-semibold leading-snug',
                        !isDark && 'text-[color:var(--worker-text)]',
                      )}
                    >
                      {item.label}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>

          {startVehicleCheckCta}
        </>
      )}

      <WorkerHomeDefaultVehicleSheet
        open={vehicleSheetOpen}
        vehicles={fleetVehicles}
        selectedVehicleId={worker?.defaultVehicleId ?? null}
        isSaving={isSavingDefaultVehicle}
        onSelect={(vehicle) => {
          void handleSelectDefaultVehicle(vehicle)
        }}
        onClose={() => {
          if (!isSavingDefaultVehicle) setVehicleSheetOpen(false)
        }}
      />

      {toastMessage ? (
        <div className="worker-toast-success fixed bottom-24 left-1/2 z-[70] w-[min(92vw,24rem)] -translate-x-1/2 rounded-xl bg-[color:var(--worker-text)] px-4 py-3 text-center text-sm font-semibold text-[color:var(--worker-bg)] shadow-lg">
          {toastMessage}
        </div>
      ) : null}
    </div>
  )
}

export default DashboardPage
