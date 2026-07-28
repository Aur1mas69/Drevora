import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyResolvedWorkerAppearance,
  clearWorkerAppearance,
} from '@/lib/workerAppearance'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import {
  getWorkerBottomNavItems,
  isWorkerNavPathActive,
  WORKER_HOME_PATH,
  type WorkerNavItem,
} from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { Home, LogOut } from 'lucide-react'
import { useLayoutEffect, useMemo } from 'react'

function navButtonClass(active: boolean) {
  return cn(
    'worker-nav-item flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2.5 text-[11px] font-medium transition-colors',
    active
      ? 'worker-nav-active'
      : 'text-[color:var(--worker-nav-inactive)] hover:bg-[color:var(--worker-input)] hover:text-[color:var(--worker-text)]',
  )
}

function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut, session } = useAuth()
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

  async function handleSignOut() {
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  function renderNavLink(item: WorkerNavItem) {
    const Icon = item.icon
    const active = isWorkerNavPathActive(location.pathname, item.to)
    return (
      <NavLink
        key={item.id}
        to={item.to}
        className={() => navButtonClass(active)}
      >
        {active ? <span className="worker-nav-indicator" aria-hidden /> : null}
        <Icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
        <span className="truncate">{item.shortLabel ?? item.label}</span>
      </NavLink>
    )
  }

  return (
    <div className="worker-mobile-layout w-full max-w-full min-w-0 bg-[color:var(--worker-bg)] text-[color:var(--worker-text)]">
      <main className="mx-auto box-border w-full min-w-0 max-w-4xl overflow-x-clip px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28 sm:px-6 sm:pt-8 lg:pb-32">
        <Outlet />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 worker-bottom-nav-shell w-full max-w-full border-t border-[color:var(--worker-border)] bg-[color:var(--worker-card)]/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-4">
        <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-lg">
          <div className="worker-bottom-nav-inner flex w-full min-w-0 items-center justify-between gap-1 rounded-[2rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-1.5">
            <NavLink
              to={WORKER_HOME_PATH}
              className={() =>
                navButtonClass(location.pathname === WORKER_HOME_PATH)
              }
              aria-label="Home"
            >
              {location.pathname === WORKER_HOME_PATH ? (
                <span className="worker-nav-indicator" aria-hidden />
              ) : null}
              <Home
                className="size-5 shrink-0"
                strokeWidth={location.pathname === WORKER_HOME_PATH ? 2.25 : 1.75}
              />
              <span className="truncate">Home</span>
            </NavLink>

            {bottomNavItems.map((item) => renderNavLink(item))}

            <button
              type="button"
              aria-label="Sign out"
              onClick={() => void handleSignOut()}
              className={navButtonClass(false)}
            >
              <LogOut className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainLayout
