import { Link } from 'react-router-dom'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import {
  formatPersonalTimeGreeting,
  getSentenceTimeGreeting,
} from '@/lib/greeting'
import { WORKER_NAV_ITEMS } from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { Truck } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

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

function DashboardPage() {
  const { worker, isLoading, error } = useCurrentWorker()
  const { companyName, companyLoading } = useCompanySettings()

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
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              {WORKER_NAV_ITEMS.map((item) => {
                const Icon = item.icon
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
              })}
            </div>
          </section>

          <Link
            to="/worker/vehicles"
            className="worker-btn-primary flex min-h-14 items-center justify-center rounded-[1.5rem] px-4 text-base font-semibold transition-colors"
          >
            Start Vehicle Check
          </Link>
        </>
      )}
    </div>
  )
}

export default DashboardPage
