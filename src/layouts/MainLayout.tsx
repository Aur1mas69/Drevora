import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  WorkerNavigationGuardProvider,
  useWorkerNavigationGuard,
} from '@/contexts/WorkerNavigationGuardContext'
import {
  applyResolvedWorkerAppearance,
  clearWorkerAppearance,
} from '@/lib/workerAppearance'
import { useAuth } from '@/contexts/AuthContext'
import {
  getWorkerBottomNavItems,
  isWorkerNavPathActive,
  WORKER_HOME_PATH,
  type WorkerNavItem,
} from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { subscribeWorkerVisualViewportSync } from '@/lib/workerVisualViewport'
import { Home } from 'lucide-react'
import { useLayoutEffect, useMemo, type MouseEvent } from 'react'

function navButtonClass(active: boolean) {
  return cn(
    'worker-nav-item flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center gap-0 rounded-2xl px-1 py-1 text-[11px] font-semibold transition-colors',
    active ? 'worker-nav-active' : 'worker-nav-idle',
  )
}

function MainLayoutShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const { attemptLeave } = useWorkerNavigationGuard()
  const userId = session?.user.id ?? null

  const bottomNavItems = useMemo(() => getWorkerBottomNavItems(), [])

  // useLayoutEffect (not useEffect) so the resolved theme applies before the
  // browser paints the Worker shell, avoiding a Light flash on a Dark device.
  useLayoutEffect(() => {
    applyResolvedWorkerAppearance(userId)
    // Leaving the Worker shell (e.g. sign-out redirect to /login) must not
    // leave worker-dark applied to the shared document.
    return () => clearWorkerAppearance()
  }, [userId])

  // iOS installed PWA: remeasure visual viewport when the Worker shell mounts
  // (after auth/legal gates). Refresh used to fix stale 100dvh cold-launch sizes.
  useLayoutEffect(() => subscribeWorkerVisualViewportSync(), [])

  function handleGuardedNavigate(to: string, event?: MouseEvent) {
    event?.preventDefault()
    attemptLeave(() => {
      navigate(to)
    })
  }

  function renderNavLink(item: WorkerNavItem) {
    const Icon = item.icon
    const active = isWorkerNavPathActive(location.pathname, item.to)
    return (
      <NavLink
        key={item.id}
        to={item.to}
        onClick={(event) => handleGuardedNavigate(item.to, event)}
        className={() => navButtonClass(active)}
      >
        {active ? <span className="worker-nav-indicator" aria-hidden /> : null}
        <span className="worker-nav-icon-wrap" aria-hidden>
          <Icon className="size-5 shrink-0" strokeWidth={active ? 2.5 : 2.25} />
        </span>
        <span className="truncate">{item.shortLabel ?? item.label}</span>
      </NavLink>
    )
  }

  return (
    <div className="worker-mobile-layout w-full max-w-full min-w-0 bg-[color:var(--worker-bg)] text-[color:var(--worker-text)]">
      <main className="mx-auto box-border w-full min-w-0 max-w-4xl overflow-x-clip px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[var(--worker-bottom-nav-clearance)] sm:px-6 sm:pt-8">
        <Outlet />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 worker-bottom-nav-shell w-full max-w-full border-t border-[color:var(--worker-border)] bg-[color:var(--worker-card)]/95 px-3 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-4">
        <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-lg">
          <div className="worker-bottom-nav-inner flex w-full min-w-0 items-center justify-between gap-0.5 rounded-[1.35rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-0.5">
            <NavLink
              to={WORKER_HOME_PATH}
              onClick={(event) => handleGuardedNavigate(WORKER_HOME_PATH, event)}
              className={() =>
                navButtonClass(location.pathname === WORKER_HOME_PATH)
              }
              aria-label="Home"
            >
              {location.pathname === WORKER_HOME_PATH ? (
                <span className="worker-nav-indicator" aria-hidden />
              ) : null}
              <span className="worker-nav-icon-wrap" aria-hidden>
                <Home
                  className="size-5 shrink-0"
                  strokeWidth={location.pathname === WORKER_HOME_PATH ? 2.5 : 2.25}
                />
              </span>
              <span className="truncate">Home</span>
            </NavLink>

            {bottomNavItems.map((item) => renderNavLink(item))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MainLayout() {
  return (
    <WorkerNavigationGuardProvider>
      <MainLayoutShell />
    </WorkerNavigationGuardProvider>
  )
}

export default MainLayout
