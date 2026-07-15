import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  HelpCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { AuthServiceError } from '@/services/authService'
import drevoraLogoFull from '@/assets/drevora-logo-full.png'
import drevoraMark from '@/assets/drevora-mark.png'
import {
  adminMainNavigationItems,
  adminSecondaryNavigationItems,
  type AdminNavItem,
} from '@/lib/adminNavigation'
import { preloadAdminDashboardPage } from '@/lib/adminDashboardRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { Button } from '@/components/ui/button'
import { getCompanyDisplayName } from '@/lib/company'
import { cn } from '@/lib/utils'

function sidebarNavLinkClass(isActive: boolean, collapsed: boolean): string {
  return cn(
    'flex w-full items-center rounded-[14px] text-left text-[13px] font-medium transition-all duration-200 ease-out',
    collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5',
    isActive
      ? 'bg-gradient-to-b from-[#4F8DFF] to-[#2F73FF] text-white shadow-[0_10px_28px_rgba(47,115,255,0.32)]'
      : 'text-slate-500 hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100',
  )
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

function SidebarNavTooltip({
  label,
  show,
  children,
}: {
  label: string
  show: boolean
  children: ReactNode
}) {
  if (!show) {
    return children
  }

  return (
    <div className="group/sidebar-tip relative">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-1/2 left-[calc(100%+0.65rem)] z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#113C69] px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-[0_8px_24px_rgba(17,60,105,0.28)] ring-1 ring-[#218EE7]/35 transition-opacity duration-150 group-hover/sidebar-tip:opacity-100 group-focus-within/sidebar-tip:opacity-100"
      >
        {label}
      </span>
    </div>
  )
}

const drevoraMarkClass = 'h-10 w-10 shrink-0 object-contain'

const sidebarFooterLabelClass =
  'text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5499BF]/85'

const sidebarFooterDividerClass = 'border-t border-[#D3E9FC]/70 dark:border-slate-700/80'

const DREVORA_SOCIAL_LINKS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61591726703180',
    icon: (
      <svg viewBox="0 0 24 24" fill="#1877F2" className="size-3.5" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/',
    icon: (
      <svg viewBox="0 0 24 24" fill="#25D366" className="size-3.5" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    ),
  },
] as const

const sidebarSocialLinkClass =
  'flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#D3E9FC] bg-[#F5FAFF]/90 transition-all duration-200 hover:border-[#BFE3F5] hover:bg-[#E8F3FE] hover:shadow-[0_4px_12px_rgba(33,142,231,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89CFF0]/60 dark:border-white/10 dark:bg-[#E8F3FE]/10 dark:hover:bg-[#E8F3FE]/20 dark:hover:shadow-[0_4px_12px_rgba(33,142,231,0.18)]'

function SidebarBrand({
  compact = false,
  collapsed = false,
}: {
  compact?: boolean
  collapsed?: boolean
}) {
  if (collapsed || compact) {
    return (
      <div
        className={cn(
          'flex items-center px-1 py-1',
          collapsed ? 'justify-center' : 'min-w-0 shrink justify-start',
        )}
      >
        <img
          src={drevoraMark}
          alt="DREVORA"
          className={drevoraMarkClass}
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-[80px] w-full items-center justify-center overflow-visible py-2">
      <img
        src={drevoraLogoFull}
        alt="DREVORA"
        className="block h-auto w-[220px] max-w-none object-contain"
        draggable={false}
      />
    </div>
  )
}

function isAdminNavItemActive(pathname: string, item: AdminNavItem): boolean {
  const prefixes = item.matchPaths ?? [item.to]

  return prefixes.some((prefix) => {
    if (item.end) {
      return pathname === prefix
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

function AdminSidebarNavItem({
  item,
  collapsed = false,
  onNavigate,
}: {
  item: AdminNavItem
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()
  const { label, icon: Icon, to, comingLater } = item
  const isActive = isAdminNavItemActive(location.pathname, item)
  const tooltipLabel = comingLater ? `${label} (Coming soon)` : label

  if (comingLater) {
    const content = (
      <div
        aria-disabled="true"
        title={collapsed ? undefined : 'Coming later'}
        className={cn(
          'flex w-full cursor-not-allowed items-center rounded-[14px] text-left text-[13px] font-medium text-slate-400',
          collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5',
        )}
      >
        <Icon className="size-[18px] shrink-0 opacity-60" strokeWidth={1.9} />
        {!collapsed ? (
          <>
            <span className="min-w-0 truncate">{label}</span>
            <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-slate-400">
              Soon
            </span>
          </>
        ) : null}
      </div>
    )

    return (
      <SidebarNavTooltip label={tooltipLabel} show={collapsed}>
        {content}
      </SidebarNavTooltip>
    )
  }

  const content = (
    <NavLink
      to={to}
      end={item.end}
      onClick={onNavigate}
      className={sidebarNavLinkClass(isActive, collapsed)}
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </NavLink>
  )

  return (
    <SidebarNavTooltip label={tooltipLabel} show={collapsed}>
      {content}
    </SidebarNavTooltip>
  )
}

function AdminSidebarMainNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="shrink-0 space-y-1 pr-1" aria-label="Main navigation">
      {adminMainNavigationItems.map((item) => (
        <AdminSidebarNavItem
          key={item.to}
          item={item}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function AdminSidebarLowerNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="space-y-1 pr-1" aria-label="Settings and support">
      {adminSecondaryNavigationItems.map((item) => (
        <AdminSidebarNavItem
          key={item.to}
          item={item}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function SidebarFooter({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const socialLinks = DREVORA_SOCIAL_LINKS.map((link) => {
    const anchor = (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        aria-label={link.label}
        className={sidebarSocialLinkClass}
      >
        {link.icon}
      </a>
    )

    return (
      <SidebarNavTooltip key={link.label} label={link.label} show={collapsed}>
        {anchor}
      </SidebarNavTooltip>
    )
  })

  if (collapsed) {
    return (
      <div className={cn('mt-3 shrink-0 space-y-2 pt-3 pb-1', sidebarFooterDividerClass)}>
        <div className="flex justify-center">
          <SidebarNavTooltip label="FAQ / Help" show>
            <Link
              to="/admin/faq"
              onClick={onNavigate}
              aria-label="FAQ / Help"
              className={sidebarSocialLinkClass}
            >
              <HelpCircle className="size-3.5 text-[#0B68BE]" strokeWidth={1.9} />
            </Link>
          </SidebarNavTooltip>
        </div>
        <div className="flex flex-col items-center gap-1.5">{socialLinks}</div>
      </div>
    )
  }

  return (
    <div className={cn('mt-3 shrink-0 px-1 pt-3 pb-1', sidebarFooterDividerClass)}>
      <p className={cn(sidebarFooterLabelClass, 'mb-1.5')}>Connect</p>
      <div className="flex items-center justify-start gap-1.5">{socialLinks}</div>
    </div>
  )
}

function SidebarNavigation({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <AdminSidebarMainNav collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      <div
        className={cn(
          'mt-auto shrink-0 pb-4',
          collapsed ? 'pt-4' : 'pt-5',
          sidebarFooterDividerClass,
        )}
      >
        <AdminSidebarLowerNav collapsed={collapsed} onNavigate={onNavigate} />
        <SidebarFooter collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
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

function AccountMenu() {
  const { session } = useAuth()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const { logOut, isLoggingOut, logoutError, clearLogoutError } = useAdminLogout()

  const email = session?.user.email ?? ''
  const displayName = getDisplayName(email)

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

function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  return (
    <aside
      className={cn(
        'relative z-10 hidden h-dvh max-h-dvh shrink-0 flex-col overflow-hidden border-r border-[#D7E8FF]/70 bg-[#FCFDFF]/94 shadow-[10px_0_40px_rgba(30,70,140,0.06)] backdrop-blur-xl transition-[width,padding] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col',
        collapsed ? 'w-20 px-2 pt-4 pb-0' : 'w-[240px] px-3 pt-6 pb-0',
      )}
    >
      <div className="group/rail pointer-events-none absolute inset-y-0 right-0 z-30 hidden w-3 translate-x-1/2 lg:block">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="pointer-events-auto absolute inset-0 w-full cursor-pointer select-none border-0 bg-transparent p-0 transition-colors hover:bg-[#E8F4FF]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]/25 dark:hover:bg-slate-800/55"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="pointer-events-auto absolute top-[80px] left-1/2 z-40 size-8 -translate-x-1/2 rounded-full border border-[#D7E8FF] bg-[#FCFDFF] text-slate-500 shadow-[0_4px_14px_rgba(33,142,231,0.14)] transition-all group-hover/rail:border-[#BFE3F5] group-hover/rail:text-[#2F73FF] group-hover/rail:shadow-[0_6px_18px_rgba(33,142,231,0.18)] hover:border-[#BFE3F5] hover:bg-white hover:text-[#2F73FF] hover:shadow-[0_6px_18px_rgba(33,142,231,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:group-hover/rail:border-slate-600 dark:group-hover/rail:text-blue-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-blue-300"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[16px]" strokeWidth={1.9} />
          ) : (
            <PanelLeftClose className="size-[16px]" strokeWidth={1.9} />
          )}
        </Button>
      </div>
      <div
        className={cn(
          'flex items-start gap-2',
          collapsed ? 'flex-col items-center' : 'w-full px-2',
        )}
      >
        <SidebarBrand collapsed={collapsed} />
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', collapsed ? 'mt-4' : 'mt-8')}>
        <SidebarNavigation collapsed={collapsed} />
      </div>
    </aside>
  )
}

function MobileNavHeader({
  onToggleMenu,
  menuOpen,
  showAccountMenu = true,
}: {
  onToggleMenu: () => void
  menuOpen: boolean
  showAccountMenu?: boolean
}) {
  return (
    <header className="admin-mobile-header fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#D7E8FF]/70 bg-[#FCFDFF]/95 px-3 shadow-sm shadow-blue-100/30 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none sm:gap-3 sm:px-4 lg:hidden">
      <SidebarBrand compact />
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav-drawer"
          onClick={onToggleMenu}
          className="size-11 shrink-0 rounded-[1rem] bg-white/90 text-slate-600 shadow-sm ring-1 ring-[#D7E8FF] transition-all duration-200 ease-out hover:bg-white hover:text-[#3B82F6] hover:shadow-md dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-blue-300"
        >
          <Menu className="size-5" strokeWidth={2} />
        </Button>
        {showAccountMenu ? <AccountMenu /> : null}
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

    window.addEventListener('keydown', handleKeyDown)

    return () => {
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
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          'admin-mobile-drawer-backdrop fixed inset-0 z-[100] bg-slate-950/45 transition-opacity duration-300 lg:hidden',
          open
            ? 'admin-mobile-drawer-backdrop--open pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        id="admin-mobile-nav-drawer"
        aria-hidden={!open}
        role="dialog"
        aria-modal={open}
        aria-label="Admin navigation"
        className={cn(
          'admin-mobile-drawer fixed inset-y-0 left-0 z-[110] flex h-svh w-[min(280px,calc(100vw-2rem))] max-w-full flex-col border-r border-[#D7E8FF]/70 bg-[#FCFDFF]/98 shadow-[10px_0_40px_rgba(30,70,140,0.12)] backdrop-blur-xl transition-[transform,visibility] duration-300 ease-out dark:border-slate-800 dark:bg-slate-900/98 dark:shadow-none lg:hidden',
          open
            ? 'admin-mobile-drawer--open visible translate-x-0'
            : 'invisible -translate-x-full pointer-events-none',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#D7E8FF]/70 px-4 py-3 dark:border-slate-800">
          <SidebarBrand compact />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="size-9 shrink-0 rounded-[0.9rem] text-slate-500 hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="size-5" strokeWidth={2} />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 pb-5">
          <SidebarNavigation onNavigate={onClose} />
        </div>
      </aside>
    </>,
    document.body,
  )
}

function NotificationBellButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="size-10 shrink-0 rounded-[1rem] bg-white/90 text-slate-500 shadow-sm ring-1 ring-[#D7E8FF] transition-all duration-200 ease-out hover:bg-white hover:text-[#3B82F6] hover:shadow-md dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-blue-300"
    >
      <Bell className="size-[18px]" />
    </Button>
  )
}

function MembershipStatusBanner() {
  const { membershipError, companyLoading } = useCompanySettings()
  if (companyLoading || !membershipError) return null

  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      {membershipError}
    </div>
  )
}

function TopBar() {
  const [now, setNow] = useState(() => new Date())
  const { session } = useAuth()
  const { settings, companyName: membershipCompanyName, formatOperationsDateTime } =
    useCompanySettings()
  const companyName = getCompanyDisplayName(membershipCompanyName ?? settings?.name)
  const displayName = getDisplayName(session?.user.email)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => window.clearInterval(intervalId)
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
        <NotificationBellButton />
        <AccountMenu />
      </div>
    </header>
  )
}

function AdminLayout({
  children,
  headerExtra,
  customHeader,
  headerLeading,
  headerSearch,
  premiumBackground = false,
  wideContent = false,
  backgroundMood = 'default',
  adminDashboard = false,
}: {
  children: ReactNode
  headerExtra?: ReactNode
  customHeader?: ReactNode
  /** Optional left-side content in the top controls row (e.g. Dashboard title). */
  headerLeading?: ReactNode
  headerSearch?: ReactNode
  premiumBackground?: boolean
  wideContent?: boolean
  backgroundMood?: 'default' | 'sunny' | 'cloudy' | 'rain' | 'night'
  adminDashboard?: boolean
}) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { collapsed: sidebarCollapsed, toggleCollapsed: toggleSidebarCollapsed } =
    useSidebarCollapsed()
  const moodClass =
    backgroundMood === 'default'
      ? ''
      : `drevora-app-shell--${backgroundMood}`

  useLayoutEffect(() => {
    document.documentElement.classList.add('admin-mobile-scroll')
    return () => {
      document.documentElement.classList.remove('admin-mobile-scroll')
    }
  }, [])

  useEffect(() => {
    preloadAdminDashboardPage()
  }, [])

  function toggleMobileMenu() {
    setMobileMenuOpen((open) => !open)
  }

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (window.innerWidth >= 1024) return

    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('position')
    document.body.style.removeProperty('top')
    document.documentElement.style.removeProperty('overflow')
  }, [location.pathname])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div
      className={cn(
        'drevora-app-shell relative min-h-dvh text-slate-950 dark:text-slate-100 lg:h-dvh lg:max-h-dvh lg:overflow-hidden lg:overflow-x-clip',
        moodClass,
      )}
    >
      <AppBackground />
      <div className="relative flex h-full w-full min-w-0 items-start lg:h-full lg:overflow-x-clip">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />

        <div
          className={cn(
            'admin-main-column relative z-10 w-full min-w-0 max-w-full flex-1 pt-14 transition-[margin] duration-300 ease-out lg:pt-0 lg:overflow-x-clip',
            sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[240px]',
            adminDashboard && 'admin-dashboard',
          )}
        >
          <MobileNavHeader
            menuOpen={mobileMenuOpen}
            onToggleMenu={toggleMobileMenu}
            showAccountMenu={!customHeader}
          />
          {mobileMenuOpen ? (
            <MobileNavDrawer open onClose={() => setMobileMenuOpen(false)} />
          ) : null}

          <main
            className={cn(
              'admin-main-content w-full min-w-0 px-4 py-4 pb-6 sm:px-6 lg:px-8 lg:overflow-x-clip',
              adminDashboard ? 'lg:py-7 lg:pb-6' : 'lg:py-7 lg:pb-7',
            )}
          >
            <div
              className={`mx-auto w-full min-w-0 ${wideContent ? 'max-w-[1520px]' : 'max-w-7xl'} ${
                adminDashboard
                  ? 'space-y-3'
                  : premiumBackground
                    ? 'space-y-5 sm:space-y-8'
                    : 'space-y-5'
              }`}
            >
              <MembershipStatusBanner />
              {customHeader ? (
                <div className="relative min-w-0">
                  <div
                    className={`mb-4 flex sm:mb-5 lg:mb-6 ${
                      headerLeading
                        ? 'flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
                        : 'items-center justify-end'
                    }`}
                  >
                    {headerLeading ? (
                      <div className="min-w-0 flex-1">{headerLeading}</div>
                    ) : null}
                    <div
                      className={`flex min-w-0 max-w-full items-center gap-3 ${
                        headerLeading ? 'justify-end sm:shrink-0' : ''
                      }`}
                    >
                      {headerSearch ? (
                        <div className="hidden min-w-0 sm:block sm:w-[min(100%,240px)] md:w-[280px] lg:w-[320px] lg:shrink-0">
                          {headerSearch}
                        </div>
                      ) : null}
                      <NotificationBellButton />
                      <AccountMenu />
                    </div>
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
