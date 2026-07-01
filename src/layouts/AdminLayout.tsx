import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import { AuthServiceError } from '@/services/authService'
import {
  adminMainNavigationItems,
  adminSecondaryNavigationItems,
  type AdminNavItem,
} from '@/lib/adminNavigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { Button } from '@/components/ui/button'
import { getCompanyDisplayName } from '@/lib/company'
import { requireSupabase } from '@/lib/supabase'

function sidebarNavLinkClass(isActive: boolean): string {
  return `flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 ease-out ${
    isActive
      ? 'bg-gradient-to-b from-[#4F8DFF] to-[#2F73FF] text-white shadow-[0_10px_28px_rgba(47,115,255,0.32)]'
      : 'text-slate-500 hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
  }`
}

function getGreeting(date = new Date()): string {
  const hour = date.getHours()

  if (hour >= 5 && hour < 12) return 'Good Morning'
  if (hour >= 12 && hour < 17) return 'Good Afternoon'
  if (hour >= 17 && hour < 22) return 'Good Evening'

  return 'Good Night'
}

function getDisplayName(email?: string, fullName?: string): string {
  if (fullName?.trim()) return fullName.trim()
  if (!email) return 'there'

  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'D'
}

function AppBackground() {
  return (
    <>
      <div aria-hidden="true" className="drevora-app-shell__orb drevora-app-shell__orb--top-left" />
      <div aria-hidden="true" className="drevora-app-shell__orb drevora-app-shell__orb--center" />
      <div aria-hidden="true" className="drevora-app-shell__orb drevora-app-shell__orb--bottom-right" />
      <div aria-hidden="true" className="drevora-app-shell__noise" />
    </>
  )
}

function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'min-w-0 shrink px-1' : 'px-5 py-5'}>
      <span
        className={`inline-block bg-gradient-to-r from-[#4F8DFF] to-[#6366F1] bg-clip-text font-extrabold uppercase tracking-[0.18em] text-transparent ${
          compact ? 'text-lg' : 'text-xl'
        }`}
      >
        DREVORA
      </span>
    </div>
  )
}

function AdminSidebarNavItem({
  item,
  onNavigate,
}: {
  item: AdminNavItem
  onNavigate?: () => void
}) {
  const { label, icon: Icon, to, end, comingLater } = item

  if (comingLater) {
    return (
      <div
        aria-disabled="true"
        title="Coming later"
        className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[13px] font-medium text-slate-400"
      >
        <Icon className="size-[18px] shrink-0 opacity-60" strokeWidth={1.9} />
        <span className="min-w-0 truncate">{label}</span>
        <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
          Soon
        </span>
      </div>
    )
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => sidebarNavLinkClass(isActive)}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function AdminSidebarNav({
  onNavigate,
  scrollable = false,
}: {
  onNavigate?: () => void
  scrollable?: boolean
}) {
  return (
    <nav
      className={`min-h-0 flex-1 space-y-1 pr-1 ${scrollable ? 'overflow-y-auto' : ''}`}
    >
      {adminMainNavigationItems.map((item) => (
        <AdminSidebarNavItem key={item.to} item={item} onNavigate={onNavigate} />
      ))}

      <div
        className="mt-6 mb-3 border-t border-[#D7E8FF]/90 dark:border-slate-700"
        role="separator"
        aria-hidden="true"
      />

      {adminSecondaryNavigationItems.map((item) => (
        <AdminSidebarNavItem key={item.to} item={item} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}
function useAdminLogout() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const logOut = useCallback(async (): Promise<boolean> => {
    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      await signOut()
      navigate('/admin-login', { replace: true })
      return true
    } catch (error) {
      const message =
        error instanceof AuthServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to log out.'
      setLogoutError(message)
      return false
    } finally {
      setIsLoggingOut(false)
    }
  }, [navigate, signOut])

  return { logOut, isLoggingOut, logoutError, clearLogoutError: () => setLogoutError(null) }
}

function SidebarFooter() {
  return (
    <div className="mt-auto shrink-0 border-t border-[#D7E8FF]/70 px-2 pt-4 pb-2 dark:border-slate-800">
      <div className="overflow-hidden rounded-[14px] border border-[#D7E8FF]/80 bg-[#F8FBFF]/90 px-3 py-3 shadow-sm shadow-blue-100/40 dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-none">
        <img
          src="/sidebar/support-truck-driver.png"
          alt=""
          className="mx-auto h-14 w-full max-w-[168px] object-contain object-center"
        />
        <p className="mt-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">Support</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Need help?</p>
        <a
          href="mailto:support@drevora.app"
          className="mt-1.5 inline-block text-[12px] font-semibold text-[#2563EB] transition-colors hover:text-[#1d4ed8]"
        >
          Contact support
        </a>
      </div>
    </div>
  )
}

function AccountMenu() {
  const { session } = useAuth()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(session?.user.email ?? '')
  const { logOut, isLoggingOut, logoutError, clearLogoutError } = useAdminLogout()

  const displayName = getDisplayName(email)

  useEffect(() => {
    if (session?.user.email) {
      setEmail(session.user.email)
      return
    }

    async function loadEmail() {
      try {
        const { data, error } = await requireSupabase().auth.getUser()
        if (!error && data.user?.email) {
          setEmail(data.user.email)
        }
      } catch {
        // Ignore profile load errors in the account menu.
      }
    }

    void loadEmail()
  }, [session])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        clearLogoutError()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        clearLogoutError()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [clearLogoutError, open])

  async function handleLogOut() {
    const success = await logOut()
    if (success) {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current)
          clearLogoutError()
        }}
        className="size-10 rounded-[1rem] bg-slate-950 text-sm font-semibold text-white shadow-sm ring-1 ring-white/40 transition-all duration-200 ease-out hover:bg-slate-800"
      >
        {getInitial(displayName)}
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute top-full right-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-[#D7E8FF]/80 bg-white/98 p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/98"
        >
          {email ? (
            <div className="border-b border-[#EEF4FF] px-2.5 py-2">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                Signed in as
              </p>
              <p className="truncate text-[13px] font-semibold text-slate-800">{email}</p>
            </div>
          ) : null}

          <button
            type="button"
            role="menuitem"
            disabled={isLoggingOut}
            onClick={() => void handleLogOut()}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left text-[13px] font-medium text-slate-600 transition-colors hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950 disabled:opacity-60"
          >
            <LogOut className="size-[18px] shrink-0" strokeWidth={1.9} />
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </button>

          {logoutError ? (
            <p className="px-2.5 py-2 text-xs font-medium text-rose-600" role="alert">
              {logoutError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="relative z-10 hidden w-[240px] shrink-0 flex-col border-r border-[#D7E8FF]/70 bg-[#FCFDFF]/94 px-3 py-6 shadow-[10px_0_40px_rgba(30,70,140,0.06)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none lg:sticky lg:top-0 lg:flex lg:h-svh lg:max-h-svh">
      <SidebarBrand />
      <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-hidden">
        <AdminSidebarNav scrollable />
        <SidebarFooter />
      </div>
    </aside>
  )
}

function MobileNavHeader({
  onOpenMenu,
  menuOpen,
}: {
  onOpenMenu: () => void
  menuOpen: boolean
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#D7E8FF]/70 bg-[#FCFDFF]/95 px-4 shadow-sm shadow-blue-100/30 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none lg:hidden">
      <SidebarBrand compact />
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav-drawer"
          onClick={onOpenMenu}
          className="size-10 shrink-0 rounded-[1rem] bg-white/90 text-slate-600 shadow-sm ring-1 ring-[#D7E8FF] transition-all duration-200 ease-out hover:bg-white hover:text-[#3B82F6] hover:shadow-md dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-blue-300"
        >
          <Menu className="size-5" strokeWidth={2} />
        </Button>
        <AccountMenu />
      </div>
    </header>
  )
}

function MobileNavDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className={`fixed inset-0 z-[100] bg-slate-950/45 transition-opacity duration-300 lg:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        id="admin-mobile-nav-drawer"
        aria-hidden={!open}
        role="dialog"
        aria-modal={open}
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-[110] flex w-[min(240px,88vw)] max-w-full flex-col border-r border-[#D7E8FF]/70 bg-[#FCFDFF]/98 shadow-[10px_0_40px_rgba(30,70,140,0.12)] backdrop-blur-xl transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-slate-900/98 dark:shadow-none lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-2 px-1">
          <SidebarBrand />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="size-9 shrink-0 rounded-[0.9rem] text-slate-500 hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950"
          >
            <X className="size-5" strokeWidth={2} />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-5">
          <AdminSidebarNav onNavigate={onClose} scrollable />
          <SidebarFooter />
        </div>
      </aside>
    </>,
    document.body,
  )
}

function TopBar() {
  const [now, setNow] = useState(() => new Date())
  const [displayName, setDisplayName] = useState('there')
  const { settings, formatOperationsDateTime } = useCompanySettings()
  const companyName = getCompanyDisplayName(settings?.name)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    async function loadHeaderProfile() {
      const { data, error } = await requireSupabase().auth.getUser()

      if (error || !data.user) {
        return
      }

      const metadata = data.user.user_metadata
      const fullName =
        typeof metadata.full_name === 'string'
          ? metadata.full_name
          : typeof metadata.name === 'string'
            ? metadata.name
            : undefined

      setDisplayName(getDisplayName(data.user.email, fullName))
    }

    void loadHeaderProfile()
  }, [])

  return (
    <header className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.15rem] dark:text-slate-100">
          {getGreeting(now)}, {displayName}
        </p>
        <div className="mt-2 space-y-1 text-sm font-medium leading-5 text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{companyName}</p>
          <p className="text-[13px] text-slate-400 dark:text-slate-500">{formatOperationsDateTime(now)}</p>
        </div>
      </div>

      <div className="hidden items-center gap-2.5 lg:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-[1rem] bg-white/90 text-slate-500 shadow-sm ring-1 ring-[#D7E8FF] transition-all duration-200 ease-out hover:bg-white hover:text-[#3B82F6] hover:shadow-md dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-blue-300"
        >
          <Bell className="size-[18px]" />
        </Button>
        <AccountMenu />
      </div>
    </header>
  )
}

function AdminLayout({
  children,
  headerExtra,
  customHeader,
  premiumBackground = false,
  wideContent = false,
  backgroundMood = 'default',
}: {
  children: ReactNode
  headerExtra?: ReactNode
  customHeader?: ReactNode
  premiumBackground?: boolean
  wideContent?: boolean
  backgroundMood?: 'default' | 'sunny' | 'cloudy' | 'rain' | 'night'
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const moodClass =
    backgroundMood === 'default'
      ? ''
      : `drevora-app-shell--${backgroundMood}`

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  return (
    <div
      className={`drevora-app-shell relative min-h-svh overflow-x-clip text-slate-950 dark:text-slate-100 ${moodClass}`}
    >
      <AppBackground />
      <div className="relative flex w-full items-start">
        <Sidebar />

        <div className="relative z-10 min-w-0 flex-1 pt-14 lg:pt-0">
          <MobileNavHeader
            menuOpen={mobileMenuOpen}
            onOpenMenu={() => setMobileMenuOpen(true)}
          />
          <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobileMenu} />

          <main className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
            <div
              className={`mx-auto ${wideContent ? 'max-w-[1520px]' : 'max-w-7xl'} ${premiumBackground ? 'space-y-8' : 'space-y-5'}`}
            >
              {customHeader ? (
                <div className="relative">
                  <div className="absolute top-0 right-0 z-20 hidden lg:block">
                    <AccountMenu />
                  </div>
                  {customHeader}
                </div>
              ) : (
                <div>
                  <TopBar />
                  {headerExtra ? <div className="mt-5">{headerExtra}</div> : null}
                </div>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
