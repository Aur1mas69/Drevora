import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  applyResolvedWorkerAppearance,
  clearWorkerAppearance,
} from '@/lib/workerAppearance'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import {
  getWorkerMoreNavItems,
  getWorkerPrimaryNavItems,
  isWorkerNavPathActive,
  WORKER_HOME_PATH,
  type WorkerNavItem,
} from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { Home, LogOut, MoreHorizontal, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

function navButtonClass(active: boolean) {
  return cn(
    'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-[11px] font-medium transition-colors',
    active
      ? 'worker-nav-active'
      : 'text-[color:var(--worker-nav-inactive)] hover:bg-[color:var(--worker-input)] hover:text-[color:var(--worker-text)]',
  )
}

function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut, session } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const morePanelRef = useRef<HTMLDivElement>(null)
  const userId = session?.user.id ?? null

  const primaryItems = useMemo(() => getWorkerPrimaryNavItems(), [])
  const moreItems = useMemo(() => getWorkerMoreNavItems(), [])

  const moreSectionActive = moreItems.some((item) =>
    isWorkerNavPathActive(location.pathname, item.to),
  )

  // useLayoutEffect (not useEffect) so the resolved theme applies before the
  // browser paints the Worker shell, avoiding a Light flash on a Dark device.
  useLayoutEffect(() => {
    applyResolvedWorkerAppearance(userId)
    // Leaving the Worker shell (e.g. sign-out redirect to /login) must not
    // leave worker-dark applied to the shared document.
    return () => clearWorkerAppearance()
  }, [userId])

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!morePanelRef.current?.contains(event.target as Node)) {
        setMoreOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [moreOpen])

  async function handleSignOut() {
    setMoreOpen(false)
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  function renderNavLink(item: WorkerNavItem) {
    const Icon = item.icon
    return (
      <NavLink
        key={item.id}
        to={item.to}
        className={() =>
          navButtonClass(isWorkerNavPathActive(location.pathname, item.to))
        }
      >
        <Icon className="size-5 shrink-0" />
        <span className="truncate">{item.shortLabel ?? item.label}</span>
      </NavLink>
    )
  }

  return (
    <div className="worker-mobile-layout w-full max-w-full min-w-0 bg-[color:var(--worker-bg)] text-[color:var(--worker-text)]">
      <main className="mx-auto box-border w-full min-w-0 max-w-4xl overflow-x-clip px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28 sm:px-6 sm:pt-8 lg:pb-32">
        <Outlet />
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-30 w-full max-w-full border-t border-[color:var(--worker-border)] bg-[color:var(--worker-elevated)]/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-4">
        <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-lg">
          {moreOpen ? (
            <div
              ref={morePanelRef}
              className="absolute inset-x-0 bottom-[calc(100%+0.65rem)] z-40 overflow-hidden rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-2"
              role="menu"
              aria-label="More Worker menu"
            >
              <div className="mb-1 flex items-center justify-between px-2 py-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--worker-text-muted)]">
                  More
                </p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-full text-[color:var(--worker-text-muted)] hover:bg-[color:var(--worker-input)] hover:text-[color:var(--worker-text)]"
                  aria-label="Close more menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid gap-1">
                {moreItems.map((item) => {
                  const Icon = item.icon
                  const active = isWorkerNavPathActive(location.pathname, item.to)
                  return (
                    <NavLink
                      key={item.id}
                      to={item.to}
                      role="menuitem"
                      className={cn(
                        'flex min-h-12 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
                        active
                          ? 'worker-nav-active'
                          : 'text-[color:var(--worker-text)] hover:bg-[color:var(--worker-input)]',
                      )}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-[color:var(--worker-text)] transition-colors hover:bg-[color:var(--worker-input)]"
                >
                  <LogOut className="size-5 shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex w-full min-w-0 items-center justify-between gap-1 rounded-[2rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-1.5">
            <NavLink
              to={WORKER_HOME_PATH}
              className={() =>
                navButtonClass(location.pathname === WORKER_HOME_PATH)
              }
              aria-label="Home"
            >
              <Home className="size-5 shrink-0" />
              <span className="truncate">Home</span>
            </NavLink>

            {primaryItems.map((item) => renderNavLink(item))}

            <button
              type="button"
              aria-label="More menu"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
              className={navButtonClass(moreOpen || moreSectionActive)}
            >
              <MoreHorizontal className="size-5 shrink-0" />
              <span className="truncate">More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainLayout
