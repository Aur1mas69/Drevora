import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Sparkles } from 'lucide-react'
import { adminNavigationItems } from '@/lib/adminNavigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

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

function SidebarFooter() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleLogOut() {
    await signOut()
    navigate('/admin-login', { replace: true })
  }

  return (
    <div className="mt-auto shrink-0 border-t border-[#D7E8FF]/70 px-2 pt-4 pb-2">
      <div className="overflow-hidden rounded-[14px] border border-[#D7E8FF]/80 bg-[#F8FBFF]/90 px-3 py-3 shadow-sm shadow-blue-100/40">
        <img
          src="/sidebar/support-truck-driver.png"
          alt=""
          className="mx-auto h-14 w-full max-w-[168px] object-contain object-center"
        />
        <p className="mt-2 text-[13px] font-semibold text-slate-800">Support</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">Need help?</p>
        <a
          href="mailto:support@drevora.app"
          className="mt-1.5 inline-block text-[12px] font-semibold text-[#2563EB] transition-colors hover:text-[#1d4ed8]"
        >
          Contact support
        </a>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={() => void handleLogOut()}
        className="mt-3 h-10 w-full justify-start gap-2.5 rounded-[14px] px-3 text-[13px] font-medium text-slate-500 hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950"
      >
        <LogOut className="size-[18px] shrink-0" strokeWidth={1.9} />
        Log out
      </Button>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="relative z-10 hidden min-h-svh w-[240px] shrink-0 flex-col border-r border-[#D7E8FF]/70 bg-[#FCFDFF]/94 px-3 py-6 shadow-[10px_0_40px_rgba(30,70,140,0.06)] backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-[52px] items-center justify-center rounded-[1.2rem] bg-[#EAF4FF] text-[#3B82F6] shadow-sm shadow-blue-100 ring-1 ring-white">
          <Sparkles className="size-6" strokeWidth={1.9} />
        </div>
        <div>
          <p className="text-xl font-semibold tracking-[-0.04em] text-slate-950">
            DREVORA
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Admin
          </p>
        </div>
      </div>

      <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {adminNavigationItems.map(({ label, icon: Icon, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 ease-out ${
                isActive
                  ? 'bg-gradient-to-b from-[#4F8DFF] to-[#2F73FF] text-white shadow-[0_10px_28px_rgba(47,115,255,0.32)]'
                  : 'text-slate-500 hover:bg-[rgba(79,141,255,0.12)] hover:text-slate-950'
              }`
            }
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <SidebarFooter />
    </aside>
  )
}

function TopBar() {
  const [now, setNow] = useState(() => new Date())
  const [displayName, setDisplayName] = useState('there')
  const [companyName, setCompanyName] = useState('Company not set')
  const { formatOperationsDateTime } = useCompanySettings()

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    async function loadHeaderProfile() {
      const { data, error } = await supabase.auth.getUser()

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
      const company =
        typeof metadata.company_name === 'string'
          ? metadata.company_name
          : typeof metadata.company === 'string'
            ? metadata.company
            : undefined

      setDisplayName(getDisplayName(data.user.email, fullName))
      if (company?.trim()) {
        setCompanyName(company.trim())
      }
    }

    void loadHeaderProfile()
  }, [])

  return (
    <header className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.15rem]">
          {getGreeting(now)}, {displayName}
        </p>
        <div className="mt-2 space-y-1 text-sm font-medium leading-5 text-slate-500">
          <p className="font-semibold text-slate-800">{companyName}</p>
          <p className="text-[13px] text-slate-400">{formatOperationsDateTime(now)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-[1rem] bg-white/90 text-slate-500 shadow-sm ring-1 ring-[#D7E8FF] transition-all duration-200 ease-out hover:bg-white hover:text-[#3B82F6] hover:shadow-md"
        >
          <Bell className="size-[18px]" />
        </Button>
        <div className="flex size-10 items-center justify-center rounded-[1rem] bg-slate-950 text-sm font-semibold text-white shadow-sm ring-1 ring-white/40">
          {getInitial(displayName)}
        </div>
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
  const moodClass =
    backgroundMood === 'default'
      ? ''
      : `drevora-app-shell--${backgroundMood}`

  return (
    <div
      className={`drevora-app-shell relative min-h-svh overflow-hidden text-slate-950 ${moodClass}`}
    >
      <AppBackground />
      <div className="relative flex min-h-svh">
        <Sidebar />

        <main className="relative z-10 min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div
            className={`mx-auto ${wideContent ? 'max-w-[1520px]' : 'max-w-7xl'} ${premiumBackground ? 'space-y-8' : 'space-y-5'}`}
          >
            {customHeader ? (
              <div>{customHeader}</div>
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
  )
}

export default AdminLayout
