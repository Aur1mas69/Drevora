import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { WorkerTimesheetSettingsForm } from '@/components/worker/WorkerTimesheetSettingsForm'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { workersManageOwnTimesheets } from '@/lib/companySettingsTypes'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import { TIMESHEET_WEEK_START_DAY_OPTIONS } from '@/lib/timesheetWeekNumber'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import type { EffectiveTimesheetSettings } from '@/lib/workerTimesheetSettingsTypes'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function formatHours(value: number): string {
  return Number.isInteger(value) ? `${value}h` : `${value}h`
}

function yesNo(value: boolean, t: (key: string, options?: { defaultValue: string }) => string): string {
  return value
    ? t('settings.yes', { defaultValue: 'Yes' })
    : t('settings.no', { defaultValue: 'No' })
}

function weekStartLabel(
  day: EffectiveTimesheetSettings['timesheetWeekStartDay'],
  t: (key: string, options?: { defaultValue: string }) => string,
): string {
  if (day === 'monday') return t('tsSettings.monday', { defaultValue: 'Monday' })
  if (day === 'sunday') return t('tsSettings.sunday', { defaultValue: 'Sunday' })
  return (
    TIMESHEET_WEEK_START_DAY_OPTIONS.find((option) => option.value === day)?.label ??
    String(day)
  )
}

function DetailRow({
  label,
  value,
  isDark,
}: {
  label: string
  value: string
  isDark: boolean
}) {
  return (
    <div
      className={cn(
        'worker-accent-divider flex items-start justify-between gap-4 border-b py-3 last:border-b-0',
        !isDark && 'border-[color:var(--worker-border)]',
      )}
    >
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
          'worker-accent-value max-w-[58%] text-right text-sm font-semibold',
          !isDark && 'text-[color:var(--worker-text)]',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function ReadOnlyTimesheetDetails({
  effective,
  isDark,
}: {
  effective: EffectiveTimesheetSettings
  isDark: boolean
}) {
  const { t } = useTranslation('worker')
  const sourceLabel =
    effective.source === 'worker'
      ? t('settings.timesheetPersonalOverride', { defaultValue: 'Personal override' })
      : effective.source === 'company'
        ? t('settings.timesheetCompanyRules', { defaultValue: 'Company rules' })
        : t('settings.timesheetDefaultRules', { defaultValue: 'Default rules' })
  const halfDayHours = Math.round(effective.defaultPaidHolidayHours * 50) / 100
  const offLabel = t('tsSettings.off', { defaultValue: 'Off' })

  return (
    <div className="space-y-4">
      <section
        className={workerAccentCardClass(0, isDark, 'worker-card rounded-[1.5rem] p-4')}
      >
        <p
          className={cn(
            'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          {t('tsSettings.appliedRules', { defaultValue: 'Applied rules' })}
        </p>
        <p
          className={cn(
            'worker-accent-secondary mt-2 text-sm',
            !isDark && 'text-[color:var(--worker-text-secondary)]',
          )}
        >
          {t('tsSettings.appliedRulesHint', {
            defaultValue:
              'These are the company timesheet rules currently applied to your account. Only your office can change them.',
          })}
        </p>
        <dl className="mt-2">
          <DetailRow
            label={t('tsSettings.source', { defaultValue: 'Source' })}
            value={sourceLabel}
            isDark={isDark}
          />
          <DetailRow
            label={t('settings.timesheetPersonalOverride', {
              defaultValue: 'Personal override',
            })}
            value={yesNo(effective.hasWorkerOverride, t)}
            isDark={isDark}
          />
        </dl>
      </section>

      <section
        className={workerAccentCardClass(1, isDark, 'worker-card rounded-[1.5rem] p-4')}
      >
        <p
          className={cn(
            'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          {t('tsSettings.overtime', { defaultValue: 'Overtime' })}
        </p>
        <dl className="mt-1">
          <DetailRow
            label={t('tsSettings.mode', { defaultValue: 'Mode' })}
            value={
              effective.overtimeMode === 'Automatic'
                ? t('tsSettings.automatic', { defaultValue: 'Automatic' })
                : t('tsSettings.manual', { defaultValue: 'Manual' })
            }
            isDark={isDark}
          />
          {effective.overtimeMode === 'Automatic' ? (
            <>
              <DetailRow
                label={t('tsSettings.calculation', { defaultValue: 'Calculation' })}
                value={
                  effective.overtimeCalculationMethod === 'daily'
                    ? t('tsSettings.daily', { defaultValue: 'Daily' })
                    : effective.overtimeCalculationMethod === 'weekly'
                      ? t('tsSettings.weekly', { defaultValue: 'Weekly' })
                      : t('tsSettings.none', { defaultValue: 'None' })
                }
                isDark={isDark}
              />
              {effective.overtimeCalculationMethod === 'daily' ? (
                <DetailRow
                  label={t('tsSettings.dailyOtAfter', { defaultValue: 'Daily OT after' })}
                  value={formatHours(effective.overtimeAfterHours)}
                  isDark={isDark}
                />
              ) : null}
              {effective.overtimeCalculationMethod === 'weekly' ? (
                <DetailRow
                  label={t('tsSettings.weeklyOtAfter', { defaultValue: 'Weekly OT after' })}
                  value={formatHours(effective.weeklyOvertimeAfterHours)}
                  isDark={isDark}
                />
              ) : null}
              <DetailRow
                label={t('tsSettings.otMultiplierShort', { defaultValue: 'OT multiplier' })}
                value={`${effective.overtimeMultiplier}×`}
                isDark={isDark}
              />
            </>
          ) : null}
        </dl>
      </section>

      <section
        className={workerAccentCardClass(2, isDark, 'worker-card rounded-[1.5rem] p-4')}
      >
        <p
          className={cn(
            'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          {t('tsSettings.breaksTime', { defaultValue: 'Breaks & time' })}
        </p>
        <dl className="mt-1">
          <DetailRow
            label={t('tsSettings.defaultBreak', { defaultValue: 'Default break (minutes)' })}
            value={t('tsSettings.minutesShort', {
              n: effective.defaultBreakMinutes,
              defaultValue: '{{n}} min',
            })}
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.paidBreaks', { defaultValue: 'Paid breaks' })}
            value={yesNo(effective.paidBreaks, t)}
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.roundTime', { defaultValue: 'Round time' })}
            value={
              effective.roundTimeMinutes === 0
                ? t('tsSettings.none', { defaultValue: 'None' })
                : t('tsSettings.minutesShort', {
                    n: effective.roundTimeMinutes,
                    defaultValue: '{{n}} min',
                  })
            }
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.weekStarts', { defaultValue: 'Week starts' })}
            value={weekStartLabel(effective.timesheetWeekStartDay, t)}
            isDark={isDark}
          />
        </dl>
      </section>

      <section
        className={workerAccentCardClass(3, isDark, 'worker-card rounded-[1.5rem] p-4')}
      >
        <p
          className={cn(
            'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          {t('tsSettings.holidayPay', { defaultValue: 'Holiday pay' })}
        </p>
        <dl className="mt-1">
          <DetailRow
            label={t('tsSettings.fullDay', { defaultValue: 'Full day' })}
            value={
              effective.defaultPaidHolidayHours === 0
                ? t('tsSettings.unpaid', { defaultValue: 'Unpaid (0 h)' })
                : formatHours(effective.defaultPaidHolidayHours)
            }
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.halfDay', { defaultValue: 'Half day' })}
            value={
              effective.defaultPaidHolidayHours === 0
                ? t('tsSettings.unpaid', { defaultValue: 'Unpaid (0 h)' })
                : formatHours(halfDayHours)
            }
            isDark={isDark}
          />
        </dl>
      </section>

      <section
        className={workerAccentCardClass(4, isDark, 'worker-card rounded-[1.5rem] p-4')}
      >
        <p
          className={cn(
            'worker-accent-muted text-xs font-semibold uppercase tracking-[0.14em]',
            !isDark && 'text-[color:var(--worker-text-muted)]',
          )}
        >
          {t('tsSettings.weekend', { defaultValue: 'Weekend' })}
        </p>
        <dl className="mt-1">
          <DetailRow
            label={t('tsSettings.saturdayOt', { defaultValue: 'Saturday OT' })}
            value={
              effective.saturdayOvertimeEnabled
                ? t('tsSettings.otOnAfter', {
                    hours: formatHours(effective.saturdayOvertimeAfterHours),
                    multiplier: effective.saturdayOvertimeMultiplier,
                    defaultValue: 'On · after {{hours}} · {{multiplier}}×',
                  })
                : offLabel
            }
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.saturdayGuaranteed', { defaultValue: 'Saturday guaranteed' })}
            value={formatHours(effective.saturdayGuaranteedPaidHours)}
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.sundayOt', { defaultValue: 'Sunday OT' })}
            value={
              effective.sundayOvertimeEnabled
                ? t('tsSettings.otOnAfter', {
                    hours: formatHours(effective.sundayOvertimeAfterHours),
                    multiplier: effective.sundayOvertimeMultiplier,
                    defaultValue: 'On · after {{hours}} · {{multiplier}}×',
                  })
                : offLabel
            }
            isDark={isDark}
          />
          <DetailRow
            label={t('tsSettings.sundayGuaranteed', { defaultValue: 'Sunday guaranteed' })}
            value={formatHours(effective.sundayGuaranteedPaidHours)}
            isDark={isDark}
          />
        </dl>
      </section>
    </div>
  )
}

/**
 * Worker Timesheet Settings.
 * Editable when the company uses Workers-manage-own-Timesheets mode.
 * Read-only when Office manages Timesheets (company rules only).
 */
export default function WorkerTimesheetSettingsPage() {
  const { t } = useTranslation('worker')
  const isDark = useIsWorkerDarkMode()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { settings } = useCompanySettings()
  const { worker, isLoading, error } = useCurrentWorker()
  const {
    effective,
    isLoading: settingsLoading,
    error: settingsError,
    refresh,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  const canEditPersonalRules = workersManageOwnTimesheets(
    settings?.timesheetManagementScope,
  )

  async function handleSignOut() {
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  if (isLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-[color:var(--worker-card)]"
        aria-label={t('tsSettings.loadingAria', {
          defaultValue: 'Loading Timesheet settings',
        })}
        role="status"
      />
    )
  }

  if (error || !worker) {
    return (
      <div className="mx-auto max-w-md space-y-4 lg:max-w-2xl">
        <WorkerSettingsBackLink />
        <div className="worker-card rounded-[1.75rem] p-5">
          <h1 className="text-lg font-semibold text-[color:var(--worker-text)]">
            {t('settings.timesheetPageTitle', { defaultValue: 'Timesheet Settings' })}
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
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:max-w-2xl">
      <header className="space-y-3">
        <WorkerSettingsBackLink />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--worker-text)]">
            {t('settings.timesheetPageTitle', { defaultValue: 'Timesheet Settings' })}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            {canEditPersonalRules
              ? t('tsSettings.editHint', {
                  defaultValue:
                    'Edit your personal Timesheet rules. Changes apply to your Timesheet calculations.',
                })
              : t('tsSettings.readOnlyHint', {
                  defaultValue:
                    'Read-only view of the company rules applied to your timesheets.',
                })}
          </p>
        </div>
      </header>

      {settingsLoading || !effective ? (
        <div
          className="min-h-40 rounded-[1.75rem] bg-[color:var(--worker-card)]"
          aria-label={t('tsSettings.loadingAria', {
          defaultValue: 'Loading Timesheet settings',
        })}
          role="status"
        />
      ) : (
        <>
          {settingsError ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {settingsError}{' '}
              {t('tsSettings.staleRules', {
                defaultValue: 'Showing the best available rules until settings reload.',
              })}
            </p>
          ) : null}
          {canEditPersonalRules ? (
            <WorkerTimesheetSettingsForm
              driverId={worker.id}
              initialEffective={effective}
              onSaved={() => refresh()}
            />
          ) : (
            <ReadOnlyTimesheetDetails effective={effective} isDark={isDark} />
          )}
        </>
      )}
    </div>
  )
}
