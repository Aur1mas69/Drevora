import { WorkerSettingsBackLink } from '@/components/worker/WorkerSettingsBackLink'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { useWorkerEffectiveTimesheetSettings } from '@/hooks/useWorkerEffectiveTimesheetSettings'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import { TIMESHEET_WEEK_START_DAY_OPTIONS } from '@/lib/timesheetWeekNumber'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { cn } from '@/lib/utils'
import type { EffectiveTimesheetSettings } from '@/lib/workerTimesheetSettingsTypes'
import { useNavigate } from 'react-router-dom'

function formatHours(value: number): string {
  return Number.isInteger(value) ? `${value}h` : `${value}h`
}

function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No'
}

function weekStartLabel(day: EffectiveTimesheetSettings['timesheetWeekStartDay']): string {
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
  const sourceLabel =
    effective.source === 'worker'
      ? 'Personal override'
      : effective.source === 'company'
        ? 'Company rules'
        : 'Default rules'

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
          Applied rules
        </p>
        <p
          className={cn(
            'worker-accent-secondary mt-2 text-sm',
            !isDark && 'text-[color:var(--worker-text-secondary)]',
          )}
        >
          These are the company timesheet rules currently applied to your account.
          Only your office can change them.
        </p>
        <dl className="mt-2">
          <DetailRow label="Source" value={sourceLabel} isDark={isDark} />
          <DetailRow
            label="Personal override"
            value={yesNo(effective.hasWorkerOverride)}
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
          Overtime
        </p>
        <dl className="mt-1">
          <DetailRow label="Mode" value={effective.overtimeMode} isDark={isDark} />
          {effective.overtimeMode === 'Automatic' ? (
            <>
              <DetailRow
                label="Calculation"
                value={
                  effective.overtimeCalculationMethod === 'daily'
                    ? 'Daily'
                    : effective.overtimeCalculationMethod === 'weekly'
                      ? 'Weekly'
                      : String(effective.overtimeCalculationMethod)
                }
                isDark={isDark}
              />
              {effective.overtimeCalculationMethod === 'daily' ? (
                <DetailRow
                  label="Daily OT after"
                  value={formatHours(effective.overtimeAfterHours)}
                  isDark={isDark}
                />
              ) : null}
              {effective.overtimeCalculationMethod === 'weekly' ? (
                <DetailRow
                  label="Weekly OT after"
                  value={formatHours(effective.weeklyOvertimeAfterHours)}
                  isDark={isDark}
                />
              ) : null}
              <DetailRow
                label="OT multiplier"
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
          Breaks &amp; time
        </p>
        <dl className="mt-1">
          <DetailRow
            label="Default break"
            value={`${effective.defaultBreakMinutes} min`}
            isDark={isDark}
          />
          <DetailRow label="Paid breaks" value={yesNo(effective.paidBreaks)} isDark={isDark} />
          <DetailRow
            label="Round time"
            value={
              effective.roundTimeMinutes === 0
                ? 'None'
                : `${effective.roundTimeMinutes} min`
            }
            isDark={isDark}
          />
          <DetailRow label="Currency" value={effective.currency} isDark={isDark} />
          <DetailRow
            label="Week starts"
            value={weekStartLabel(effective.timesheetWeekStartDay)}
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
          Weekend
        </p>
        <dl className="mt-1">
          <DetailRow
            label="Saturday OT"
            value={
              effective.saturdayOvertimeEnabled
                ? `On · after ${formatHours(effective.saturdayOvertimeAfterHours)} · ${effective.saturdayOvertimeMultiplier}×`
                : 'Off'
            }
            isDark={isDark}
          />
          <DetailRow
            label="Saturday guaranteed"
            value={formatHours(effective.saturdayGuaranteedPaidHours)}
            isDark={isDark}
          />
          <DetailRow
            label="Sunday OT"
            value={
              effective.sundayOvertimeEnabled
                ? `On · after ${formatHours(effective.sundayOvertimeAfterHours)} · ${effective.sundayOvertimeMultiplier}×`
                : 'Off'
            }
            isDark={isDark}
          />
          <DetailRow
            label="Sunday guaranteed"
            value={formatHours(effective.sundayGuaranteedPaidHours)}
            isDark={isDark}
          />
        </dl>
      </section>
    </div>
  )
}

/**
 * Worker Timesheet Settings — read-only view of rules applied to this Worker.
 * Workers cannot edit company timesheet rules here.
 */
export default function WorkerTimesheetSettingsPage() {
  const isDark = useIsWorkerDarkMode()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { worker, isLoading, error } = useCurrentWorker()
  const {
    effective,
    isLoading: settingsLoading,
    error: settingsError,
  } = useWorkerEffectiveTimesheetSettings(worker?.id)

  async function handleSignOut() {
    await signOut()
    navigate(LOGIN_PATH, { replace: true })
  }

  if (isLoading) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-[color:var(--worker-card)]"
        aria-label="Loading Timesheet settings"
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
            Timesheet settings
          </h1>
          <p className="mt-2 text-sm text-[color:var(--worker-text-secondary)]">
            {error ??
              'We could not find a worker profile linked to your account.'}
          </p>
          <Button type="button" className="mt-4" onClick={() => void handleSignOut()}>
            Sign out
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
            Timesheet settings
          </h1>
          <p className="mt-1 text-sm text-[color:var(--worker-text-secondary)]">
            Read-only view of the rules applied to your timesheets.
          </p>
        </div>
      </header>

      {settingsLoading || !effective ? (
        <div
          className="min-h-40 rounded-[1.75rem] bg-[color:var(--worker-card)]"
          aria-label="Loading Timesheet settings"
          role="status"
        />
      ) : (
        <>
          {settingsError ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {settingsError} Showing the best available rules until settings reload.
            </p>
          ) : null}
          <ReadOnlyTimesheetDetails effective={effective} isDark={isDark} />
        </>
      )}
    </div>
  )
}
