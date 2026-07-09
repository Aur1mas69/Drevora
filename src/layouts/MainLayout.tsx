import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { History, Home, LogOut, Palmtree, User } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home },
  { label: 'My Holidays', to: '/worker/holidays', icon: Palmtree },
  { label: 'History', to: '/history', icon: History },
  { label: 'Profile', to: '/profile', icon: User },
]

function MainLayout() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh overflow-x-hidden bg-[#F6F9FF] text-slate-950">
      <main className="mx-auto w-full min-w-0 max-w-4xl px-4 pt-5 pb-28 sm:px-6 sm:pt-8 lg:pb-32">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 rounded-[2rem] border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70 lg:max-w-lg">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-3xl px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-[#EAF4FF] text-[#2F80ED]'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700',
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="size-12 rounded-3xl text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default MainLayout
