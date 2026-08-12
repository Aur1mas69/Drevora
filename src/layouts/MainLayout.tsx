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
import homeBlueIcon from '@/assets/worker-nav/home-blue.png'
import homeGrayIcon from '@/assets/worker-nav/home-gray.png'
import contactsBlueIcon from '@/assets/worker-nav/contacts-blue.png'
import contactsGrayIcon from '@/assets/worker-nav/contacts-gray.png'
import notesBlueIcon from '@/assets/worker-nav/notes-blue.png'
import notesGrayIcon from '@/assets/worker-nav/notes-gray.png'
import settingsBlueIcon from '@/assets/worker-nav/settings-blue.png'
import settingsGrayIcon from '@/assets/worker-nav/settings-gray.png'
import { useLayoutEffect, useMemo, type MouseEvent } from 'react'

const WORKER_BOTTOM_NAV_ICONS: Record<
  string,
  { active: string; inactive: string }
> = {
  home: { active: homeBlueIcon, inactive: homeGrayIcon },
  contacts: { active: contactsBlueIcon, inactive: contactsGrayIcon },
  notes: { active: notesBlueIcon, inactive: notesGrayIcon },
  settings: { active: settingsBlueIcon, inactive: settingsGrayIcon },
}

function WorkerBottomNavIcon({
  id,
  active,
}: {
  id: keyof typeof WORKER_BOTTOM_NAV_ICONS | string
  active: boolean
}) {
  const pair = WORKER_BOTTOM_NAV_ICONS[id]
  if (!pair) return null
  return (
    <img
      src={active ? pair.active : pair.inactive}
      alt=""
      width={32}
      height={32}
      draggable={false}
      className="worker-nav-icon-img size-8 shrink-0 object-contain"
    />
  )
}

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
          <WorkerBottomNavIcon id={item.id} active={active} />
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
                <WorkerBottomNavIcon
                  id="home"
                  active={location.pathname === WORKER_HOME_PATH}
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
