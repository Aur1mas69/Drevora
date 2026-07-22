import { WorkerTimesheetSettingsForm } from '@/components/worker/WorkerTimesheetSettingsForm'
import { Button } from '@/components/ui/button'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { WORKER_LOGIN_PATH } from '@/lib/membershipRoles'
import { useAuth } from '@/contexts/AuthContext'
import { ChevronLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function WorkerTimesheetSettingsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { worker, isLoading, error } = useCurrentWorker()
  const {
    effective,
    isLoading: settingsLoading,
    error: settingsError,
    refresh,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  async function handleSignOut() {
    await signOut()
    navigate(WORKER_LOGIN_PATH, { replace: true })
  }

  if (isLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-white/60"
        aria-label="Loading Timesheet settings"
        role="status"
      />
    )
  }

  if (error || !worker) {
    return (
      <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
        <BackToSettingsLink />
        <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">Timesheet settings</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ??
              'We could not find a worker profile linked to your account.'}
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
      <header className="space-y-3">
        <BackToSettingsLink />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Timesheet settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your own payroll and overtime rules. Company settings are the
            starting defaults.
          </p>
        </div>
      </header>

      {settingsLoading || !effective ? (
        <div
          className="min-h-40 rounded-[1.75rem] bg-white/60"
          aria-label="Loading Timesheet settings"
          role="status"
        />
      ) : (
        <>
          {settingsError ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {settingsError} Showing company defaults until your personal settings
              can be loaded.
            </p>
          ) : null}
          <WorkerTimesheetSettingsForm
            driverId={worker.id}
            initialEffective={effective}
            onSaved={async () => {
              await refresh()
              navigate('/worker/settings')
            }}
          />
        </>
      )}
    </div>
  )
}

function BackToSettingsLink() {
  return (
    <Link
      to="/worker/settings"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-[#2F80ED] transition-colors hover:text-[#2569C7]"
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      Settings
    </Link>
  )
}
