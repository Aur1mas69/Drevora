import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { getAppVersionLabel } from '@/lib/appVersion'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import {
  applyResolvedWorkerAppearance,
  applyWorkerAppearance,
  DEFAULT_WORKER_APPEARANCE,
  writeWorkerAppearancePreference,
  type WorkerAppearance,
} from '@/lib/workerAppearance'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { formatWorkerTimesheetSettingsSummary } from '@/lib/workerTimesheetSettingsSummary'
import { cn } from '@/lib/utils'
import {
  DriversServiceError,
  setWorkerDefaultVehicle,
} from '@/services/driversService'
import {
  ChevronRight,
  CircleHelp,
  Clock,
  Contact,
  Lock,
  LogOut,
  Moon,
  Sun,
  Truck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'Not set'
}

function SettingsRowLink({
  to,
  icon: Icon,
  title,
  subtitle,
  className,
  isDark,
}: {
  to: string
  icon: typeof Clock
  title: string
  subtitle?: string
  className?: string
  isDark: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-11 w-full min-w-0 items-center gap-2.5 worker-list-row',
        !isDark &&
          'active:bg-[color:var(--worker-input)] hover:bg-[color:var(--worker-input)]',
        className,
      )}
    >
      <span
        className={cn(
          'worker-accent-icon-well flex size-9 shrink-0 items-center justify-center rounded-xl',
          !isDark &&
            'bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            'worker-accent-title block text-sm font-semibold',
            !isDark && 'text-[color:var(--worker-text)]',
          )}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            className={cn(
              'worker-accent-secondary mt-0.5 block truncate text-xs font-medium',
              !isDark && 'text-[color:var(--worker-text-secondary)]',
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
      <ChevronRight
        className={cn(
          'worker-accent-muted size-5 shrink-0',
          !isDark && 'text-[color:var(--worker-text-muted)]',
        )}
        aria-hidden
      />
    </Link>
  )
}

function ProfileField({
  label,
  value,
  isDark,
}: {
  label: string
  value: string
  isDark: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt
        className={cn(
          'worker-accent-secondary text-sm font-medium',
          !isDark && 'text-[color:var(--worker-text-secondary)]',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'worker-accent-value max-w-[60%] text-right text-sm font-semibold',
          !isDark && 'text-[color:var(--worker-text)]',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export default function WorkerSettingsPage() {
  const isDark = useIsWorkerDarkMode()
  const navigate = useNavigate()
  const { signOut, session } = useAuth()
  const { worker, isLoading, error, reload } = useCurrentWorker()
  const { companyName, companyLoading } = useCompanySettings()
  const userId = session?.user.id ?? null
  const {
    effective,
    isLoading: settingsLoading,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  const [appearance, setAppearance] = useState<WorkerAppearance>(
    DEFAULT_WORKER_APPEARANCE,
  )
  const [isRemovingDefault, setIsRemovingDefault] = useState(false)
  const [defaultVehicleError, setDefaultVehicleError] = useState<string | null>(null)

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

  async function handleRemoveDefaultVehicle() {
    if (!worker?.defaultVehicleId) return
    setIsRemovingDefault(true)
    setDefaultVehicleError(null)
    try {
      await setWorkerDefaultVehicle(null)
      reload()
    } catch (removeError) {
      setDefaultVehicleError(
        removeError instanceof DriversServiceError
          ? removeError.message
          : removeError instanceof Error
            ? removeError.message
            : 'Unable to remove your default vehicle.',
      )
    } finally {
      setIsRemovingDefault(false)
    }
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

  const fullName = `${worker.firstName} ${worker.lastName}`.trim() || 'Worker'
  const email = displayValue(session?.user.email ?? worker.email)
  const company = displayValue(companyName?.trim() || worker.company)
  const phoneNumber = worker.phone?.trim() || null
  const defaultVehicleLabel =
    worker.defaultVehicleRegistration?.trim() ||
    worker.assignment?.trim() ||
    null
  const hasDefaultVehicle = Boolean(worker.defaultVehicleId || defaultVehicleLabel)
  const timesheetSummary =
    !settingsLoading && effective
      ? formatWorkerTimesheetSettingsSummary(effective)
      : 'Loading…'

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          Settings
        </h1>
      </header>

      <section
        className={workerAccentCardClass(0, isDark, 'worker-card rounded-[1.75rem] p-5')}
        aria-labelledby="worker-settings-profile"
      >
        <h2
          id="worker-settings-profile"
          className={cn(
            'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          Profile
        </h2>
        <div className="mt-4 flex items-center gap-4">
          <WorkerAvatar
            firstName={worker.firstName}
            lastName={worker.lastName}
            avatarUrl={worker.avatarUrl}
            size="md"
          />
          <div className="min-w-0">
            <p
              className={cn(
                'worker-accent-title truncate text-lg font-semibold',
                !isDark && 'text-[color:var(--worker-text)]',
              )}
            >
              {fullName}
            </p>
            <p
              className={cn(
                'worker-accent-secondary truncate text-sm',
                !isDark && 'text-[color:var(--worker-text-secondary)]',
              )}
            >
              {email}
            </p>
          </div>
        </div>
        <dl
          className={cn(
            'worker-accent-divider mt-4 space-y-3 border-t pt-4',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <ProfileField label="Company" value={company} isDark={isDark} />
          {phoneNumber ? (
            <ProfileField label="Phone" value={phoneNumber} isDark={isDark} />
          ) : null}
        </dl>
        <p
          className={cn(
            'worker-accent-muted mt-4 text-xs',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          Profile details are managed by your office.
        </p>
      </section>

      <section
        className={workerAccentCardClass(
          1,
          isDark,
          'worker-card overflow-hidden rounded-[1.75rem]',
        )}
        aria-labelledby="worker-settings-preferences"
      >
        <div
          className={cn(
            'worker-accent-divider border-b px-4 py-3',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <h2
            id="worker-settings-preferences"
            className={cn(
              'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
              !isDark && 'text-[color:var(--worker-text-muted)]',
            )}
          >
            Preferences
          </h2>
        </div>

        <SettingsRowLink
          to="/worker/settings/timesheet"
          icon={Clock}
          title="Timesheet Settings"
          subtitle={timesheetSummary}
          isDark={isDark}
        />

        <div
          className={cn(
            'worker-accent-divider border-t px-4 py-3.5',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'worker-accent-icon-well flex size-10 shrink-0 items-center justify-center rounded-2xl',
                !isDark &&
                  'bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]',
              )}
            >
              <Truck className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'worker-accent-title text-sm font-semibold',
                  !isDark && 'text-[color:var(--worker-text)]',
                )}
              >
                Default Vehicle
              </p>
              <p
                className={cn(
                  'worker-accent-secondary mt-0.5 truncate text-xs font-medium',
                  !isDark && 'text-[color:var(--worker-text-secondary)]',
                )}
              >
                {defaultVehicleLabel ?? 'No default vehicle'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/worker/vehicles"
                  className={cn(
                    'worker-accent-pill inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-xs font-semibold transition-colors',
                    !isDark &&
                      'border-[#89CFF0] bg-[#E8F3FE] text-[#0B68BE] hover:bg-[#DCEEFF] active:bg-[#D3E9FC]',
                  )}
                >
                  Change default vehicle
                </Link>
                {hasDefaultVehicle ? (
                  <button
                    type="button"
                    disabled={isRemovingDefault}
                    onClick={() => void handleRemoveDefaultVehicle()}
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRemovingDefault ? 'Removing…' : 'Remove default'}
                  </button>
                ) : null}
              </div>
              {defaultVehicleError ? (
                <p className="mt-2 text-xs font-medium text-rose-600">{defaultVehicleError}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'worker-accent-divider border-t px-4 py-3.5',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <p
            className={cn(
              'worker-accent-title text-sm font-semibold',
              !isDark && 'text-[color:var(--worker-text)]',
            )}
          >
            Appearance
          </p>
          <div
            className={cn(
              'mt-3 grid grid-cols-2 gap-1 rounded-2xl border p-1',
              isDark
                ? 'worker-accent-pill border-transparent'
                : 'border-[color:var(--worker-border)] bg-[color:var(--worker-input)]',
            )}
            role="radiogroup"
            aria-label="Appearance"
          >
            {(
              [
                { value: 'light' as const, label: 'Light', icon: Sun },
                { value: 'dark' as const, label: 'Dark', icon: Moon },
              ] as const
            ).map((option) => {
              const selected = appearance === option.value
              const Icon = option.icon
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-pressed={selected}
                  onClick={() => handleAppearanceChange(option.value)}
                  className={cn(
                    'worker-appearance-option inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--worker-card)]',
                    selected
                      ? isDark
                        ? 'bg-white/90 text-[#0b0d12] shadow-sm'
                        : 'bg-[color:var(--worker-card)] text-[color:var(--worker-text)] shadow-sm'
                      : isDark
                        ? 'text-inherit opacity-80 hover:opacity-100'
                        : 'text-[color:var(--worker-text-secondary)] hover:text-[color:var(--worker-text)]',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section
        className={workerAccentCardClass(
          2,
          isDark,
          'worker-card overflow-hidden rounded-[1.75rem]',
        )}
        aria-labelledby="worker-settings-security"
      >
        <div
          className={cn(
            'worker-accent-divider border-b px-4 py-3',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <h2
            id="worker-settings-security"
            className={cn(
              'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
              !isDark && 'text-[color:var(--worker-text-muted)]',
            )}
          >
            Security
          </h2>
        </div>
        <SettingsRowLink
          to="/worker/settings/security"
          icon={Lock}
          title="Password & Security"
          subtitle={
            import.meta.env.MODE === 'native'
              ? 'Password and biometric app lock'
              : 'Change your sign-in password'
          }
          isDark={isDark}
        />
      </section>

      <section
        className={workerAccentCardClass(
          3,
          isDark,
          'worker-card overflow-hidden rounded-[1.75rem]',
        )}
        aria-labelledby="worker-settings-help"
      >
        <div
          className={cn(
            'worker-accent-divider border-b px-4 py-3',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <h2
            id="worker-settings-help"
            className={cn(
              'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
              !isDark && 'text-[color:var(--worker-text-muted)]',
            )}
          >
            Help &amp; Information
          </h2>
        </div>

        <SettingsRowLink
          to="/worker/settings/contact-office"
          icon={Contact}
          title="Contact Office"
          subtitle="Work, rota and company questions"
          isDark={isDark}
        />

        <SettingsRowLink
          to="/worker/settings/help"
          icon={CircleHelp}
          title="Help & Support"
          subtitle="Guides, bugs, feedback and legal"
          className={cn(
            'worker-accent-divider border-t',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
          isDark={isDark}
        />

        <div
          className={cn(
            'worker-accent-divider worker-list-row justify-between border-t',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <span
            className={cn(
              'worker-accent-title text-sm font-semibold',
              !isDark && 'text-[color:var(--worker-text)]',
            )}
          >
            App Version
          </span>
          <span
            className={cn(
              'worker-accent-secondary text-sm font-medium',
              !isDark && 'text-[color:var(--worker-text-secondary)]',
            )}
          >
            {getAppVersionLabel()}
          </span>
        </div>
      </section>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2 rounded-2xl border border-rose-300 bg-[color:var(--worker-card)] text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        onClick={() => void handleSignOut()}
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </div>
  )
}
