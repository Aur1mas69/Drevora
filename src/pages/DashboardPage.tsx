import { Link } from 'react-router-dom'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  formatPersonalTimeGreeting,
  getSentenceTimeGreeting,
} from '@/lib/greeting'
import { WORKER_NAV_ITEMS, type WorkerNavItem } from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { ChevronRight, Truck } from 'lucide-react'
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

/** Existing 51 KB WebP asset — rendered directly, never duplicated or inlined. */
const WORKER_ROBOT_DARK_SRC = '/assets/worker/drevora-worker-robot-dark.webp'
const WORKER_ROBOT_DARK_SIZE = 256

/**
 * Curated Dark-mode Quick Actions order. Uses the same `WORKER_NAV_ITEMS`
 * route/permission source as Light mode — no duplicated route logic, this
 * only selects which existing items surface here (Settings stays reachable
 * from the bottom nav "More" menu instead of duplicating it as a tile).
 */
const DARK_QUICK_ACTION_IDS = [
  'timesheets',
  'holidays',
  'vehicles',
  'documents',
  'driver-reports',
  'contacts',
] as const

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

function WorkerHomeHeader({
  firstName,
  companyName,
  isNameLoading = false,
}: {
  firstName: string | null
  companyName: string
  isNameLoading?: boolean
}) {
  const headerRef = useRef<HTMLElement>(null)

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

  const greeting = isNameLoading
    ? getSentenceTimeGreeting()
    : formatPersonalTimeGreeting(firstName)

  return (
    <header ref={headerRef} className="worker-home-header w-full min-w-0 max-w-full space-y-1">
      <h1 className="max-w-full text-3xl font-semibold tracking-tight break-words text-[color:var(--worker-text)]">
        {greeting}
      </h1>
      {companyName ? (
        <p className="max-w-full text-sm font-medium break-words text-[color:var(--worker-text-secondary)]">
          {companyName}
        </p>
      ) : (
        <div
          className="h-4 w-36 max-w-full animate-pulse rounded-full bg-[color:var(--worker-border)]"
          aria-hidden
        />
      )}
    </header>
  )
}

/** Dark-mode only premium hero. Robot is decorative — empty alt, aria-hidden. */
function WorkerHomeRobotHero() {
  return (
    <section className="rounded-[1.75rem] bg-gradient-to-br from-[#A3F1AB]/60 to-[#4344F6]/60 p-px">
      <div className="worker-robot-hero relative isolate flex items-center gap-3 overflow-hidden rounded-[calc(1.75rem-1px)] px-5 py-5 sm:gap-5 sm:px-6 sm:py-6">
        <div className="relative z-10 min-w-0 flex-1 space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Let's get things done!
          </h2>
          <p className="text-sm leading-snug text-white/70">
            Here's what's happening with your work today.
          </p>
        </div>
        <img
          src={WORKER_ROBOT_DARK_SRC}
          alt=""
          aria-hidden="true"
          width={WORKER_ROBOT_DARK_SIZE}
          height={WORKER_ROBOT_DARK_SIZE}
          loading="eager"
          decoding="async"
          className="worker-robot-hero__image relative z-10 aspect-square w-[clamp(5.5rem,26vw,8.5rem)] shrink-0 select-none"
        />
      </div>
    </section>
  )
}

function DashboardPage() {
  const { worker, isLoading, error } = useCurrentWorker()
  const { companyName, companyLoading } = useCompanySettings()
  const isDark = useIsWorkerDarkMode()

  const verifiedCompany =
    companyName?.trim() || worker?.company?.trim() || ''
  const firstName = worker?.firstName ?? null

  if (!isLoading && (error || !worker)) {
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

  const quickActionItems: readonly WorkerNavItem[] = isDark
    ? DARK_QUICK_ACTION_IDS.map((id) =>
        WORKER_NAV_ITEMS.find((item) => item.id === id),
      ).filter((item): item is WorkerNavItem => Boolean(item))
    : WORKER_NAV_ITEMS

  return (
    <div className="mx-auto box-border w-full min-w-0 max-w-md space-y-5 overflow-x-clip lg:max-w-3xl">
      <WorkerHomeHeader
        firstName={firstName}
        companyName={verifiedCompany}
        isNameLoading={isLoading}
      />

      {isLoading || companyLoading ? (
        <div
          className="min-h-[40vh] rounded-[1.75rem] bg-[color:var(--worker-card)]"
          aria-label="Loading worker home"
          role="status"
        />
      ) : (
        <>
          {isDark ? <WorkerHomeRobotHero /> : null}

          {defaultVehicleLabel ? (
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] px-4 py-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--worker-primary-soft)]">
                <Truck className="size-5 text-[color:var(--worker-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]">
                  Default vehicle
                </p>
                <p className="truncate text-sm font-semibold text-[color:var(--worker-text)]">
                  {defaultVehicleLabel}
                </p>
              </div>
            </div>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--worker-text-muted)]">
              Quick actions
            </h2>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-3">
              {quickActionItems.map((item, index) => {
                const Icon = item.icon
                if (!isDark) {
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      className={cn(
                        'flex min-h-[6.5rem] flex-col justify-between rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-4 transition-colors',
                        'hover:border-[color:var(--worker-primary)] hover:bg-[color:var(--worker-primary-soft)] active:bg-[color:var(--worker-primary-soft)]',
                      )}
                    >
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-[color:var(--worker-primary-soft)]">
                        <Icon className="size-5 text-[color:var(--worker-primary)]" />
                      </div>
                      <p className="text-base font-semibold text-[color:var(--worker-text)]">{item.label}</p>
                    </Link>
                  )
                }

                const isMint = index % 2 === 0
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={cn(
                      'flex min-h-[6.5rem] flex-col justify-between rounded-[1.5rem] p-4 transition-transform active:scale-[0.98]',
                      isMint
                        ? 'worker-quick-action-mint text-[#08130c]'
                        : 'worker-quick-action-indigo text-white',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'flex size-11 items-center justify-center rounded-2xl',
                          isMint ? 'bg-black/10' : 'bg-white/15',
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <ChevronRight className="size-4 opacity-70" aria-hidden />
                    </div>
                    <p className="text-base font-semibold">{item.label}</p>
                  </Link>
                )
              })}
            </div>
          </section>

          <Link
            to="/worker/vehicles"
            className={cn(
              'flex min-h-14 items-center justify-center gap-2 rounded-[1.5rem] px-4 text-base font-semibold transition-colors',
              isDark ? 'worker-cta-gradient text-white' : 'worker-btn-primary',
            )}
          >
            Start Vehicle Check
            {isDark ? <ChevronRight className="size-5" aria-hidden /> : null}
          </Link>
        </>
      )}
    </div>
  )
}

export default DashboardPage
