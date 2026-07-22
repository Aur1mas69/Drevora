import { WorkerTimesheetSettingsForm } from '@/components/worker/WorkerTimesheetSettingsForm'
import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import {
  type CompanyTheme,
} from '@/lib/companySettingsTypes'
import { WORKER_LOGIN_PATH } from '@/lib/membershipRoles'
import {
  applyResolvedWorkerAppearance,
  readWorkerAppearancePreference,
  writeWorkerAppearancePreference,
} from '@/lib/workerAppearance'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const APPEARANCE_OPTIONS: { value: CompanyTheme; label: string; hint: string }[] =
  [
    { value: 'light', label: 'Light', hint: 'Always use light mode' },
    { value: 'dark', label: 'Dark', hint: 'Always use dark mode' },
    {
      value: 'system',
      label: 'System',
      hint: 'Match your device or browser preference',
    },
  ]

export default function WorkerSettingsPage() {
  const navigate = useNavigate()
  const { signOut, session } = useAuth()
  const { worker, isLoading, error } = useCurrentWorker()
  const { companyName, theme: companyTheme, companyLoading } = useCompanySettings()
  const userId = session?.user.id ?? null
  const {
    effective,
    isLoading: settingsLoading,
    error: settingsError,
    refresh,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  const [appearance, setAppearance] = useState<CompanyTheme>('light')

  useEffect(() => {
    if (companyLoading) return
    const resolved = applyResolvedWorkerAppearance(userId, companyTheme)
    setAppearance(resolved)
  }, [companyLoading, companyTheme, userId])

  async function handleSignOut() {
    await signOut()
    navigate(WORKER_LOGIN_PATH, { replace: true })
  }

  function handleAppearanceChange(next: CompanyTheme) {
    setAppearance(next)
    if (userId) {
      writeWorkerAppearancePreference(userId, next)
      return
    }
    applyResolvedWorkerAppearance(null, next)
  }

  if (isLoading || companyLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-white/60"
        aria-label="Loading settings"
        role="status"
      />
    )
  }

  if (error || !worker) {
    return (
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error ??
            'We could not find a worker profile linked to your account.'}
        </p>
        <Button type="button" className="mt-4" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
      </div>
    )
  }

  const fullName = `${worker.firstName} ${worker.lastName}`.trim()
  const email = session?.user.email ?? worker.email
  const hasPersonalAppearance = Boolean(
    userId && readWorkerAppearancePreference(userId),
  )

  return (
    <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your Worker profile and Timesheet rules.
        </p>
      </header>

      <section className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <WorkerAvatar
            firstName={worker.firstName}
            lastName={worker.lastName}
            avatarUrl={worker.avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-950 dark:text-white">
              {fullName || 'Worker'}
            </p>
            <p className="truncate text-sm text-slate-500">{email}</p>
            <p className="mt-1 truncate text-xs font-medium text-slate-400">
              {companyName?.trim() || worker.company || 'Company'}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SettingsRow label="Phone" value={worker.phone?.trim() || 'Not set'} />
        <SettingsRow
          label="Default vehicle"
          value={
            worker.defaultVehicleRegistration?.trim() ||
            worker.assignment?.trim() ||
            'Not set'
          }
          isLast
        />
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <h2 className="text-lg font-semibold text-slate-950">Timesheet Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Configure your own payroll and overtime rules. Company settings are the
            starting defaults.
          </p>
        </div>
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
              onSaved={refresh}
            />
          </>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose how DREVORA looks on this device. This does not change Company
          Settings for your office.
        </p>
        <div className="mt-4 grid gap-2">
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = appearance === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleAppearanceChange(option.value)}
                className={cn(
                  'flex min-h-14 flex-col items-start rounded-2xl border px-4 py-3 text-left transition-colors',
                  selected
                    ? 'border-[#2F80ED] bg-[#EAF4FF] dark:bg-[#12365C]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
                )}
              >
                <span className="text-sm font-semibold text-slate-950 dark:text-white">
                  {option.label}
                </span>
                <span className="text-xs text-slate-500">{option.hint}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          {hasPersonalAppearance
            ? 'Saved for your Worker account on this browser.'
            : `Currently following company default (${companyTheme}).`}
        </p>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <SettingsRow
          label="Password & security"
          value="Managed in your sign-in account"
          isLast
        />
      </section>

      <p className="px-1 text-xs text-slate-400">
        Profile photo, phone and vehicle defaults are managed by your office.
        Company Settings and admin tools are not available in the Worker app.
      </p>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-2xl"
        onClick={() => void handleSignOut()}
      >
        Sign out
      </Button>
    </div>
  )
}

function SettingsRow({
  label,
  value,
  isLast = false,
}: {
  label: string
  value: string
  isLast?: boolean
}) {
  return (
    <div
      className={
        isLast
          ? 'flex items-start justify-between gap-4 px-4 py-4'
          : 'flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 dark:border-slate-800'
      }
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="max-w-[60%] text-right text-sm font-semibold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  )
}
