import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import {
  applyResolvedWorkerAppearance,
  applyWorkerAppearance,
  DEFAULT_WORKER_APPEARANCE,
  readWorkerAppearancePreference,
  writeWorkerAppearancePreference,
  type WorkerAppearance,
} from '@/lib/workerAppearance'
import { formatWorkerTimesheetSettingsSummary } from '@/lib/workerTimesheetSettingsSummary'
import { cn } from '@/lib/utils'
import { ChevronRight, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const APPEARANCE_OPTIONS: { value: WorkerAppearance; label: string; hint: string }[] =
  [
    { value: 'light', label: 'Light', hint: 'Bright background, dark text' },
    { value: 'dark', label: 'Dark', hint: 'Dark background, light text' },
  ]

export default function WorkerSettingsPage() {
  const navigate = useNavigate()
  const { signOut, session } = useAuth()
  const { worker, isLoading, error } = useCurrentWorker()
  const { companyName, companyLoading } = useCompanySettings()
  const userId = session?.user.id ?? null
  const {
    effective,
    isLoading: settingsLoading,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  const [appearance, setAppearance] = useState<WorkerAppearance>(
    DEFAULT_WORKER_APPEARANCE,
  )

  useEffect(() => {
    setAppearance(applyResolvedWorkerAppearance(userId))
  }, [userId])

  async function handleSignOut() {
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  function handleAppearanceChange(next: WorkerAppearance) {
    setAppearance(next)
    if (userId) {
      writeWorkerAppearancePreference(userId, next)
      return
    }
    applyWorkerAppearance(next)
  }

  if (isLoading || companyLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-[color:var(--worker-card)]"
        aria-label="Loading settings"
        role="status"
      />
    )
  }

  if (error || !worker) {
    return (
      <div className="worker-card rounded-[1.75rem] p-5">
        <h1 className="text-lg font-semibold text-[color:var(--worker-text)]">Settings</h1>
        <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
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
  const timesheetSummary =
    !settingsLoading && effective
      ? formatWorkerTimesheetSettingsSummary(effective)
      : 'Loading…'

  return (
    <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
          Your Worker profile and preferences.
        </p>
      </header>

      <section className="worker-card rounded-[1.75rem] p-5">
        <div className="flex items-center gap-4">
          <WorkerAvatar
            firstName={worker.firstName}
            lastName={worker.lastName}
            avatarUrl={worker.avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-[color:var(--worker-text)]">
              {fullName || 'Worker'}
            </p>
            <p className="truncate text-sm text-[color:var(--worker-text-secondary)]">{email}</p>
            <p className="mt-1 truncate text-xs font-medium text-[color:var(--worker-text-muted)]">
              {companyName?.trim() || worker.company || 'Company'}
            </p>
          </div>
        </div>
      </section>

      <section className="worker-card overflow-hidden rounded-[1.75rem]">
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

      <section className="worker-card overflow-hidden rounded-[1.75rem]">
        <Link
          to="/worker/settings/timesheet"
          className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[color:var(--worker-input)]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]">
            <Clock className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-semibold text-[color:var(--worker-text)]">
              Timesheet settings
            </span>
            <span className="mt-0.5 block truncate text-xs font-medium text-[color:var(--worker-text-secondary)]">
              {timesheetSummary}
            </span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-[color:var(--worker-text-muted)]"
            aria-hidden
          />
        </Link>
      </section>

      <section className="worker-card rounded-[1.75rem] p-4">
        <h2 className="text-base font-semibold text-[color:var(--worker-text)]">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
          Choose how DREVORA looks on this device. This does not change Company
          Settings for your office.
        </p>
        <div
          className="mt-4 grid gap-2"
          role="radiogroup"
          aria-label="Appearance"
        >
          {APPEARANCE_OPTIONS.map((option) => {
            const selected = appearance === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-pressed={selected}
                onClick={() => handleAppearanceChange(option.value)}
                className={cn(
                  'flex min-h-14 flex-col items-start rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--worker-bg)]',
                  selected
                    ? 'border-[color:var(--worker-primary)] bg-[color:var(--worker-primary-soft)]'
                    : 'border-[color:var(--worker-border)] bg-[color:var(--worker-card)] hover:bg-[color:var(--worker-input)]',
                )}
              >
                <span className="text-sm font-semibold text-[color:var(--worker-text)]">
                  {option.label}
                </span>
                <span className="text-xs text-[color:var(--worker-text-secondary)]">{option.hint}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-[color:var(--worker-text-muted)]">
          {hasPersonalAppearance
            ? 'Saved for your Worker account on this browser.'
            : 'Using Light by default on this device.'}
        </p>
      </section>

      <section className="worker-card overflow-hidden rounded-[1.75rem]">
        <SettingsRow
          label="Password & security"
          value="Managed in your sign-in account"
          isLast
        />
      </section>

      <p className="px-1 text-xs text-[color:var(--worker-text-muted)]">
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
          : 'flex items-start justify-between gap-4 border-b border-[color:var(--worker-border)] px-4 py-4'
      }
    >
      <p className="text-sm font-medium text-[color:var(--worker-text-secondary)]">{label}</p>
      <p className="max-w-[60%] text-right text-sm font-semibold text-[color:var(--worker-text)]">
        {value}
      </p>
    </div>
  )
}
