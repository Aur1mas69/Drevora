import { WorkerAvatar } from '@/components/workers/WorkerAvatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { WorkerHomeDefaultVehicleSheet } from '@/components/worker/WorkerHomeDefaultVehicleSheet'
import { WorkerLanguageFlag } from '@/components/worker/WorkerLanguageFlag'
import { WorkerLanguagePickerSheet } from '@/components/worker/WorkerLanguagePickerSheet'
import { useWorkerLocale } from '@/i18n/workerLocaleContext'
import {
  WORKER_LANGUAGE_LABELS,
  type WorkerLanguage,
} from '@/i18n/languages'
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
import { cn } from '@/lib/utils'
import {
  DriversServiceError,
  setWorkerDefaultVehicle,
} from '@/services/driversService'
import {
  fetchVehicles,
  isTrailerFleetAsset,
  type Vehicle,
} from '@/services/vehiclesService'
import {
  Building2,
  ChevronRight,
  CircleHelp,
  Clock,
  Languages,
  Lock,
  LogOut,
  Moon,
  Sun,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

function displayValue(
  value: string | null | undefined,
  notSet: string,
): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : notSet
}

const SETTINGS_ICON_STROKE = 1.75

function SettingsRowIconBadge({
  icon: Icon,
  isDark,
}: {
  icon: LucideIcon
  isDark: boolean
}) {
  return (
    <span
      className={cn(
        'worker-accent-icon-well flex size-9 shrink-0 items-center justify-center rounded-full',
        !isDark &&
          'bg-[color:var(--worker-primary-soft)] text-[color:var(--worker-primary)]',
      )}
    >
      <Icon
        className="block size-[1.125rem]"
        strokeWidth={SETTINGS_ICON_STROKE}
        aria-hidden
      />
    </span>
  )
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
  icon: LucideIcon
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
      <SettingsRowIconBadge icon={Icon} isDark={isDark} />
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
  const { t } = useTranslation('worker')
  const {
    language,
    isSaving: isSavingLanguage,
    error: languageError,
    setLanguage,
  } = useWorkerLocale()
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
  const [isSavingDefaultVehicle, setIsSavingDefaultVehicle] = useState(false)
  const [defaultVehicleError, setDefaultVehicleError] = useState<string | null>(null)
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false)
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false)
  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([])

  useEffect(() => {
    setAppearance(applyResolvedWorkerAppearance(userId))
  }, [userId])

  useEffect(() => {
    if (!vehicleSheetOpen) return

    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchVehicles({ lifecycle: 'active' })
        if (!cancelled) setFleetVehicles(rows)
      } catch {
        if (!cancelled) setFleetVehicles([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [vehicleSheetOpen])

  async function handleSignOut() {
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  function handleLanguageChange(next: WorkerLanguage) {
    setLanguagePickerOpen(false)
    if (next === language || isSavingLanguage) return
    void setLanguage(next)
  }

  function handleAppearanceChange(next: WorkerAppearance) {
    setAppearance(next)
    if (userId) {
      writeWorkerAppearancePreference(userId, next)
      return
    }
    applyWorkerAppearance(next)
  }

  async function handleSelectDefaultVehicle(vehicle: Vehicle) {
    if (isTrailerFleetAsset(vehicle)) return
    if (vehicle.id === worker?.defaultVehicleId) {
      setVehicleSheetOpen(false)
      return
    }

    setIsSavingDefaultVehicle(true)
    setDefaultVehicleError(null)
    try {
      await setWorkerDefaultVehicle(vehicle.id)
      reload()
      setVehicleSheetOpen(false)
    } catch (saveError) {
      setDefaultVehicleError(
        saveError instanceof DriversServiceError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : t('settings.saveDefaultFailed', {
                defaultValue: 'Unable to save your default vehicle.',
              }),
      )
    } finally {
      setIsSavingDefaultVehicle(false)
    }
  }

  async function handleRemoveDefaultVehicle() {
    if (!worker?.defaultVehicleId) return
    setIsRemovingDefault(true)
    setDefaultVehicleError(null)
    try {
      await setWorkerDefaultVehicle(null)
      reload()
      setVehicleSheetOpen(false)
    } catch (removeError) {
      setDefaultVehicleError(
        removeError instanceof DriversServiceError
          ? removeError.message
          : removeError instanceof Error
            ? removeError.message
            : t('settings.removeDefaultFailed', {
                defaultValue: 'Unable to remove your default vehicle.',
              }),
      )
    } finally {
      setIsRemovingDefault(false)
    }
  }

  if (isLoading || companyLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-[color:var(--worker-card)]"
        aria-label={t('settings.loading', { defaultValue: 'Loading settings' })}
        role="status"
      />
    )
  }

  if (error || !worker) {
    return (
      <div className="worker-card rounded-[1.75rem] p-5">
        <h1 className="text-lg font-semibold text-[color:var(--worker-text)]">
          {t('settings.title', { defaultValue: 'Settings' })}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
          {error ??
            t('settings.profileMissing', {
              defaultValue:
                'We could not find a worker profile linked to your account.',
            })}
        </p>
        <Button type="button" className="mt-4" onClick={() => void handleSignOut()}>
          {t('settings.signOut', { defaultValue: 'Sign out' })}
        </Button>
      </div>
    )
  }

  const notSet = t('settings.notSet', { defaultValue: 'Not set' })
  const fullName = `${worker.firstName} ${worker.lastName}`.trim() || t('home.workerFallback', { defaultValue: 'Worker' })
  const email = displayValue(session?.user.email ?? worker.email, notSet)
  const company = displayValue(companyName?.trim() || worker.company, notSet)
  const phoneNumber = worker.phone?.trim() || null
  const defaultVehicleLabel =
    worker.defaultVehicleRegistration?.trim() ||
    worker.assignment?.trim() ||
    null
  const timesheetSummary =
    !settingsLoading && effective
      ? (() => {
          const sourceLabel = effective.hasWorkerOverride
            ? t('settings.timesheetPersonal', { defaultValue: 'Personal settings' })
            : t('settings.timesheetCompany', { defaultValue: 'Company defaults' })
          if (effective.overtimeMode === 'Manual') {
            return t('settings.timesheetManual', {
              source: sourceLabel,
              defaultValue: `Manual · ${sourceLabel}`,
            })
          }
          if (effective.overtimeCalculationMethod === 'daily') {
            return t('settings.timesheetDaily', {
              hours: effective.overtimeAfterHours,
              defaultValue: `Automatic · Daily OT after ${effective.overtimeAfterHours}h`,
            })
          }
          if (effective.overtimeCalculationMethod === 'weekly') {
            return t('settings.timesheetWeekly', {
              hours: effective.weeklyOvertimeAfterHours,
              defaultValue: `Automatic · Weekly OT after ${effective.weeklyOvertimeAfterHours}h`,
            })
          }
          return t('settings.timesheetAutomatic', {
            source: sourceLabel,
            defaultValue: `Automatic · ${sourceLabel}`,
          })
        })()
      : t('settings.loadingShort', { defaultValue: 'Loading…' })

  return (
    <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
          {t('settings.title', { defaultValue: 'Settings' })}
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
          {t('settings.profile', { defaultValue: 'Profile' })}
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
          <ProfileField
            label={t('settings.company', { defaultValue: 'Company' })}
            value={company}
            isDark={isDark}
          />
          {phoneNumber ? (
            <ProfileField
              label={t('settings.phone', { defaultValue: 'Phone' })}
              value={phoneNumber}
              isDark={isDark}
            />
          ) : null}
        </dl>
        <p
          className={cn(
            'worker-accent-muted mt-4 text-xs',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          {t('settings.profileManagedByOffice', {
            defaultValue: 'Profile details are managed by your office.',
          })}
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
            {t('settings.preferences', { defaultValue: 'Preferences' })}
          </h2>
        </div>

        <SettingsRowLink
          to="/worker/settings/timesheet"
          icon={Clock}
          title={t('settings.timesheetSettings', { defaultValue: 'Timesheet Settings' })}
          subtitle={timesheetSummary}
          isDark={isDark}
        />

        <SettingsRowLink
          to="/worker/settings/help/legal/company-privacy-notice"
          icon={Building2}
          title={t('settings.companyNotice', { defaultValue: 'Company Notice' })}
          subtitle={t('settings.companyNoticeSubtitle', {
            defaultValue: 'Your employer’s privacy notice',
          })}
          className={cn(
            'worker-accent-divider border-t',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
          isDark={isDark}
        />

        <div
          className={cn(
            'worker-accent-divider border-t',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <button
            type="button"
            className={cn(
              'flex min-h-11 w-full min-w-0 items-center gap-2.5 worker-list-row',
              !isDark &&
                'active:bg-[color:var(--worker-input)] hover:bg-[color:var(--worker-input)]',
            )}
            aria-haspopup="dialog"
            aria-expanded={vehicleSheetOpen}
            aria-busy={isSavingDefaultVehicle || isRemovingDefault}
            onClick={() => setVehicleSheetOpen(true)}
          >
            <SettingsRowIconBadge icon={Truck} isDark={isDark} />
            <span
              className={cn(
                'worker-accent-title min-w-0 flex-1 text-left text-sm font-semibold',
                !isDark && 'text-[color:var(--worker-text)]',
              )}
            >
              {t('settings.defaultVehicle', { defaultValue: 'Default Vehicle' })}
            </span>
            <span
              className={cn(
                'worker-accent-secondary max-w-[45%] shrink-0 truncate text-sm font-medium',
                !isDark && 'text-[color:var(--worker-text-secondary)]',
              )}
            >
              {defaultVehicleLabel ?? notSet}
            </span>
            <ChevronRight
              className={cn(
                'worker-accent-muted size-5 shrink-0',
                !isDark && 'text-[color:var(--worker-text-muted)]',
              )}
              aria-hidden
            />
          </button>
          {defaultVehicleError ? (
            <p className="px-4 pb-3 text-xs font-medium text-rose-600">
              {defaultVehicleError}
            </p>
          ) : null}
        </div>

        <WorkerHomeDefaultVehicleSheet
          open={vehicleSheetOpen}
          vehicles={fleetVehicles}
          selectedVehicleId={worker.defaultVehicleId ?? null}
          isSaving={isSavingDefaultVehicle || isRemovingDefault}
          onSelect={(vehicle) => {
            void handleSelectDefaultVehicle(vehicle)
          }}
          onClear={() => {
            void handleRemoveDefaultVehicle()
          }}
          onClose={() => {
            if (!isSavingDefaultVehicle && !isRemovingDefault) {
              setVehicleSheetOpen(false)
            }
          }}
        />

        <div
          className={cn(
            'worker-accent-divider border-t',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <button
            type="button"
            className={cn(
              'flex min-h-11 w-full min-w-0 items-center gap-2.5 worker-list-row',
              !isDark &&
                'active:bg-[color:var(--worker-input)] hover:bg-[color:var(--worker-input)]',
            )}
            aria-haspopup="dialog"
            aria-expanded={languagePickerOpen}
            aria-busy={isSavingLanguage}
            onClick={() => setLanguagePickerOpen(true)}
          >
            <SettingsRowIconBadge icon={Languages} isDark={isDark} />
            <span
              className={cn(
                'worker-accent-title min-w-0 flex-1 text-left text-sm font-semibold',
                !isDark && 'text-[color:var(--worker-text)]',
              )}
            >
              {t('settings.language', { defaultValue: 'Language' })}
            </span>
            <span
              className={cn(
                'worker-accent-secondary inline-flex shrink-0 items-center gap-1.5 text-sm font-medium',
                !isDark && 'text-[color:var(--worker-text-secondary)]',
              )}
            >
              <WorkerLanguageFlag language={language} />
              <span>
                {isSavingLanguage
                  ? t('settings.languageSaving', { defaultValue: 'Saving…' })
                  : WORKER_LANGUAGE_LABELS[language]}
              </span>
            </span>
            <ChevronRight
              className={cn(
                'worker-accent-muted size-5 shrink-0',
                !isDark && 'text-[color:var(--worker-text-muted)]',
              )}
              aria-hidden
            />
          </button>
          {languageError ? (
            <p className="px-4 pb-3 text-xs font-medium text-rose-600">
              {t('settings.languageSaveError', { defaultValue: languageError })}
            </p>
          ) : null}
        </div>

        <WorkerLanguagePickerSheet
          open={languagePickerOpen}
          language={language}
          title={t('settings.language', { defaultValue: 'Language' })}
          isSaving={isSavingLanguage}
          onSelect={handleLanguageChange}
          onClose={() => setLanguagePickerOpen(false)}
        />

        <div
          className={cn(
            'worker-accent-divider border-t',
            !isDark && 'border-[color:var(--worker-border)]',
          )}
        >
          <div className="flex min-h-11 w-full min-w-0 items-center gap-2.5 worker-list-row">
            <SettingsRowIconBadge icon={Sun} isDark={isDark} />
            <span
              className={cn(
                'worker-accent-title min-w-0 flex-1 text-left text-sm font-semibold',
                !isDark && 'text-[color:var(--worker-text)]',
              )}
            >
              {t('settings.appearance', { defaultValue: 'Appearance' })}
            </span>
            <div
              role="radiogroup"
              aria-label={t('settings.appearance', { defaultValue: 'Appearance' })}
              className={cn(
                'inline-flex h-8 shrink-0 items-center rounded-xl border p-0.5',
                isDark
                  ? 'worker-accent-pill border-transparent'
                  : 'border-[color:var(--worker-border)] bg-[color:var(--worker-input)]',
              )}
            >
              {(
                [
                  {
                    value: 'light' as const,
                    label: t('settings.light', { defaultValue: 'Light' }),
                    icon: Sun,
                  },
                  {
                    value: 'dark' as const,
                    label: t('settings.dark', { defaultValue: 'Dark' }),
                    icon: Moon,
                  },
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
                      'worker-appearance-option inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--worker-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--worker-card)]',
                      selected
                        ? isDark
                          ? 'bg-white/90 text-[#0b0d12] shadow-sm'
                          : 'bg-[color:var(--worker-primary)] text-white shadow-sm'
                        : isDark
                          ? 'text-inherit opacity-80 hover:opacity-100'
                          : 'text-[color:var(--worker-text-secondary)] hover:text-[color:var(--worker-text)]',
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                    {option.label}
                  </button>
                )
              })}
            </div>
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
            {t('settings.security', { defaultValue: 'Security' })}
          </h2>
        </div>
        <SettingsRowLink
          to="/worker/settings/security"
          icon={Lock}
          title={t('settings.passwordSecurity', { defaultValue: 'Password & Security' })}
          subtitle={
            import.meta.env.MODE === 'native'
              ? t('security.passwordBiometric', {
                  defaultValue: 'Password and biometric app lock',
                })
              : t('security.changePassword', {
                  defaultValue: 'Change your sign-in password',
                })
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
            {t('settings.helpInformation', { defaultValue: 'Help & Information' })}
          </h2>
        </div>

        <SettingsRowLink
          to="/worker/settings/help"
          icon={CircleHelp}
          title={t('settings.helpSupport', { defaultValue: 'Help & Support' })}
          subtitle={t('settings.helpSupportSubtitle', {
            defaultValue: 'Guides, bugs, feedback and legal',
          })}
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
            {t('settings.appVersion', { defaultValue: 'App Version' })}
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
        className={cn(
          'h-12 w-full gap-2 rounded-2xl border border-rose-300 bg-[color:var(--worker-card)] text-rose-700 hover:bg-rose-50 hover:text-rose-800',
          isDark &&
            'border-rose-400/55 bg-[color:var(--worker-elevated)] text-rose-300 hover:bg-rose-950/45 hover:text-rose-200',
        )}
        onClick={() => void handleSignOut()}
      >
        <LogOut className="size-4" aria-hidden />
        {t('settings.signOut', { defaultValue: 'Sign out' })}
      </Button>
    </div>
  )
}
