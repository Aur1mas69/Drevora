import { Link } from 'react-router-dom'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { getTimeGreeting } from '@/lib/greeting'
import { WORKER_NAV_ITEMS } from '@/lib/workerNavigation'
import { cn } from '@/lib/utils'
import { Truck } from 'lucide-react'

function DashboardPage() {
  const { worker, isLoading, error } = useCurrentWorker()
  const { companyName, companyLoading } = useCompanySettings()

  if (isLoading || companyLoading) {
    return (
      <div
        className="min-h-[50vh] rounded-[1.75rem] bg-white/60"
        aria-label="Loading worker home"
        role="status"
      />
    )
  }

  if (error || !worker) {
    return (
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">Worker profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ??
            'We could not find a worker profile linked to your account. Please contact your manager.'}
        </p>
      </div>
    )
  }

  const firstName = worker.firstName.trim() || 'Worker'
  const verifiedCompany =
    companyName?.trim() || worker.company?.trim() || 'Your company'
  const defaultVehicleLabel =
    worker.defaultVehicleRegistration?.trim() ||
    worker.assignment?.trim() ||
    null

  return (
    <div className="mx-auto max-w-md space-y-5 lg:max-w-3xl">
      <header className="space-y-1">
        <p className="text-sm font-medium text-slate-500">{getTimeGreeting()}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Hello, {firstName}
        </h1>
        <p className="text-sm font-medium text-slate-500">{verifiedCompany}</p>
      </header>

      {defaultVehicleLabel ? (
        <div className="flex items-center gap-3 rounded-[1.5rem] border border-slate-100 bg-white px-4 py-3 shadow-sm shadow-slate-200/50">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-[#EAF4FF]">
            <Truck className="size-5 text-[#2F80ED]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Default vehicle
            </p>
            <p className="truncate text-sm font-semibold text-slate-950">
              {defaultVehicleLabel}
            </p>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
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
                  'flex min-h-[6.5rem] flex-col justify-between rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-lg shadow-slate-200/60 transition-colors',
                  'hover:border-[#BFDFFF] hover:bg-[#F8FBFF] active:bg-[#EAF4FF]',
                )}
              >
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[#EAF4FF]">
                  <Icon className="size-5 text-[#2F80ED]" />
                </div>
                <p className="text-base font-semibold text-slate-950">{item.label}</p>
              </Link>
            )
          })}
        </div>
      </section>

      <Link
        to="/worker/vehicles"
        className="flex min-h-14 items-center justify-center rounded-[1.5rem] bg-[#2F80ED] px-4 text-base font-semibold text-white shadow-lg shadow-blue-200/70 transition-colors hover:bg-[#2569C7]"
      >
        Start Vehicle Check
      </Link>
    </div>
  )
}

export default DashboardPage
