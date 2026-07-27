import { Link } from 'react-router-dom'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  formatPersonalTimeGreeting,
  getSentenceTimeGreeting,
} from '@/lib/greeting'
import { getWorkerHomeQuickActionItems } from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { ChevronRight, Truck } from 'lucide-react'
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

/** Existing 51 KB WebP asset — rendered directly, never duplicated or inlined,
 * shown in both Light and Dark mode. */
const WORKER_ROBOT_SRC = '/assets/worker/drevora-worker-robot-dark.webp'
const WORKER_ROBOT_SIZE = 256

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
    <section className="relative isolate flex items-end gap-3 px-5 pt-5 pb-5 sm:gap-5 sm:px-6 sm:pt-6 sm:pb-6">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 bottom-0 z-0 min-h-[5.75rem] rounded-[1.75rem] p-px min-[380px]:min-h-[7.75rem] sm:min-h-[9.75rem] lg:min-h-[12.25rem]',
          isDark
            ? 'bg-gradient-to-br from-[#A3F1AB]/60 to-[#4344F6]/60'
            : 'bg-[color:var(--worker-border)]',
        )}
      >
        <div className="worker-robot-hero relative h-full w-full overflow-hidden rounded-[calc(1.75rem-1px)]" />
      </div>

      <div className="relative z-10 min-w-0 flex-1 space-y-1.5 pb-1">
        <h2
          className={cn(
            'text-xl font-semibold tracking-tight sm:text-2xl',
            isDark ? 'text-white' : 'text-[color:var(--worker-text)]',
          )}
        >
          Let's get things done!
        </h2>
        <p
          className={cn(
            'text-sm leading-snug',
            isDark ? 'text-white/70' : 'text-[color:var(--worker-text-secondary)]',
          )}
        >
          Here's what's happening with your work today.
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
        className="worker-robot-hero__image relative z-10 aspect-square w-[7rem] shrink-0 select-none min-[380px]:w-[9rem] sm:w-[11rem] lg:w-[13.5rem]"
      />
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

  // Exactly 4 Quick actions cards (Timesheets, Holiday Requests, Vehicles,
  // Documents), same route/permission source, in both Light and Dark.
  // Contacts/Settings live only in the bottom nav; Sign out is bottom-nav only.
  const quickActionItems = getWorkerHomeQuickActionItems()

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
          <WorkerHomeRobotHero isDark={isDark} />

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
            <div className="grid grid-cols-2 gap-3">
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
            to="/worker/vehicle-checks"
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
