import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { WorkerHomeRoadBackground } from '@/components/worker/WorkerHomeRoadBackground'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
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
import { cn } from '@/lib/utils'
import { fetchVehicles } from '@/services/vehiclesService'
import {
  ChevronRight,
  MoonStar,
  ShieldCheck,
  Sun,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

/** Existing 51 KB WebP asset — rendered directly, never duplicated or inlined,
 * shown in both Light and Dark mode. */
const WORKER_ROBOT_SRC = '/assets/worker/drevora-worker-robot-dark.webp'
const WORKER_ROBOT_SIZE = 256

function getGreetingPeriodIcon(date = new Date()): LucideIcon {
  const hour = date.getHours()
  // Morning + afternoon: sun. Evening + night: moon.
  if (hour >= 5 && hour < 17) return Sun
  return MoonStar
}

function subscribeWorkerDarkMode(onChange: () => void): () => void {
  const root = document.documentElement
  const observer = new MutationObserver(onChange)
  observer.observe(root, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getWorkerDarkModeSnapshot(): boolean {
  return document.documentElement.classList.contains('worker-dark')
}

function getWorkerDarkModeServerSnapshot(): boolean {
  return false
}

/**
 * Reactive read of the `worker-dark` class toggled by `src/lib/workerAppearance.ts`
 * (Worker Settings → Appearance). Uses `useSyncExternalStore` so Home updates
 * immediately on theme change without polling or duplicating theme state.
 */
function useIsWorkerDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeWorkerDarkMode,
    getWorkerDarkModeSnapshot,
    getWorkerDarkModeServerSnapshot,
  )
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
        <GreetingIcon className="size-5" strokeWidth={1.85} />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
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
 * Premium hero shown on Worker Home in both Light and Dark mode. Robot is
 * decorative — empty alt, aria-hidden.
 *
 * The coloured "card" (gradient border in Dark, existing border token in
 * Light) is a background layer sized shorter than the row via `min-h-*`, so
 * the robot — a normal, bottom-aligned flex child — has its head/raised hand
 * extend ~20px above the card's own top edge without ever exceeding this
 * section's own padding box (no `overflow: visible` hacks needed). The text
 * column keeps `min-w-0 flex-1` and the robot `shrink-0`, so on narrow
 * screens the copy wraps instead of the row overflowing horizontally.
 */
function WorkerHomeRobotHero({ isDark }: { isDark: boolean }) {
  return (
    <section className="relative isolate flex items-end gap-3 px-5 pt-4 pb-4 sm:gap-5 sm:px-6 sm:pt-5 sm:pb-5">
      {/* Banner shell: min-height defines the paint box; road img is a direct absolute child so it cannot collapse to 0. */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 bottom-0 z-0 min-h-[5.75rem] overflow-hidden rounded-[1.75rem] min-[380px]:min-h-[7.75rem] sm:min-h-[9.75rem] lg:min-h-[12.25rem]',
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

      <div className="relative z-[2] min-w-0 flex-1 space-y-1.5 self-center -translate-y-1 pr-1 pl-0.5 sm:-translate-y-2">
        <h2
          className={cn(
            'text-xl font-bold leading-[1.2] tracking-tight sm:text-2xl [font-weight:700]',
            isDark ? 'text-white' : 'text-[#0B1F3A]',
          )}
        >
          Ready for the road?
        </h2>
        <p
          className={cn(
            'max-w-[16.5rem] text-sm leading-snug sm:max-w-[20rem]',
            isDark ? 'text-white/70' : 'text-[#3D5A80]',
          )}
        >
          Check your vehicle, review today’s tasks, and start your shift with
          confidence.
        </p>
      </div>

      <img
        src={WORKER_ROBOT_SRC}
        alt=""
        aria-hidden="true"
        width={WORKER_ROBOT_SIZE}
        height={WORKER_ROBOT_SIZE}
        loading="eager"
        decoding="async"
        className="worker-robot-hero__image relative z-[2] aspect-square w-[7rem] shrink-0 select-none min-[380px]:w-[9rem] sm:w-[11rem] lg:w-[13.5rem]"
      />
    </section>
  )
}

function DashboardPage() {
  const { session } = useAuth()
  const { worker, isLoading, error } = useCurrentWorker()
  const { companyId, companyLoading } = useCompanySettings()
  const isDark = useIsWorkerDarkMode()
  const [isOnline, setIsOnline] = useState(true)
  const [offlinePrepared, setOfflinePrepared] = useState<boolean | null>(null)

  const greetingWorkerName = worker
    ? resolveGreetingFullName(worker.firstName, worker.lastName)
    : isLoading
      ? null
      : 'Worker'

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
      <div className="mx-auto box-border w-full min-w-0 max-w-md space-y-5 overflow-x-clip lg:max-w-3xl">
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
    <div className="mx-auto box-border w-full min-w-0 max-w-md space-y-5 overflow-x-clip lg:max-w-3xl">
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

          {defaultVehicleLabel ? (
            <div className="worker-home-default-vehicle flex items-center gap-3.5 px-4 py-3.5">
              <div className="worker-home-icon-well">
                <Truck className="size-6" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]">
                  Default vehicle
                </p>
                <p className="mt-0.5 truncate text-[15px] font-semibold leading-snug text-[color:var(--worker-text)]">
                  {defaultVehicleLabel}
                </p>
              </div>
            </div>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--worker-text-muted)]">
              Quick actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {quickActionItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className="worker-home-quick-action"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="worker-home-icon-well">
                        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                      </div>
                      <ChevronRight className="worker-home-chevron mt-0.5" aria-hidden />
                    </div>
                    <p className="text-[15px] font-semibold leading-snug text-[color:var(--worker-text)]">
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
    </div>
  )
}

export default DashboardPage
