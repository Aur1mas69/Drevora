import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimesheetWeekLabel } from '@/components/timesheets/TimesheetWeekLabel'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { DEFAULT_TIMESHEET_WEEK_SETTINGS } from '@/lib/companySettingsTypes'
import { getDefaultWeekStartMonday, normalizeWeekStartForCompany } from '@/lib/timesheetUtils'
import { formatTimesheetWeekDisplay } from '@/lib/timesheetWeekNumber'
import type { Driver } from '@/services/driversService'
import { Users, User, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export type NewTimesheetMode = 'single' | 'allActive' | 'driversByRole'

type NewTimesheetModalProps = {
  isOpen: boolean
  drivers: Driver[]
  isSaving?: boolean
  error?: string | null
  onClose: () => void
  onCreateSingle: (driverId: string, weekStart: string) => void
  onCreateBulk: (mode: 'allActive' | 'driversByRole', weekStart: string) => void
}

const inputClassName =
  'mt-1.5 h-10 w-full rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:ring-blue-900/40'

const modeOptions: { value: NewTimesheetMode; label: string; description: string }[] = [
  {
    value: 'single',
    label: 'One worker',
    description: 'Create a timesheet for a single worker.',
  },
  {
    value: 'allActive',
    label: 'All active workers',
    description: 'Create draft timesheets for every worker with Working status.',
  },
  {
    value: 'driversByRole',
    label: 'Drivers only',
    description: 'Create draft timesheets for active workers with the Driver role.',
  },
]

export function NewTimesheetModal({
  isOpen,
  drivers,
  isSaving = false,
  error = null,
  onClose,
  onCreateSingle,
  onCreateBulk,
}: NewTimesheetModalProps) {
  const { settings } = useCompanySettings()
  const [mode, setMode] = useState<NewTimesheetMode>('single')
  const [driverId, setDriverId] = useState('')
  const [weekStart, setWeekStart] = useState(getDefaultWeekStartMonday())

  const weekDisplay = useMemo(() => {
    const weekSettings = settings
      ? {
          timesheetWeekStartDay: settings.timesheetWeekStartDay,
          timesheetWeekResetMonth: settings.timesheetWeekResetMonth,
          timesheetWeekResetDay: settings.timesheetWeekResetDay,
        }
      : DEFAULT_TIMESHEET_WEEK_SETTINGS

    return formatTimesheetWeekDisplay(weekStart, weekSettings)
  }, [settings, weekStart])

  const activeDrivers = useMemo(
    () => drivers.filter((driver) => driver.status === 'Working'),
    [drivers],
  )

  const activeDriverRoleCount = useMemo(
    () => activeDrivers.filter((driver) => driver.role === 'Driver').length,
    [activeDrivers],
  )

  useEffect(() => {
    if (!isOpen) return
    setMode('single')
    setDriverId(activeDrivers[0]?.id ?? drivers[0]?.id ?? '')
    setWeekStart(getDefaultWeekStartMonday())
  }, [activeDrivers, drivers, isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-[18px] bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-900/95 dark:ring-white/10 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-timesheet-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="new-timesheet-title"
              className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100"
            >
              New Timesheet
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create a timesheet for a worker and week. Hours and daily notes are entered after creation.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isSaving}
            className="size-8 shrink-0 rounded-[10px] text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <X className="size-4" />
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[10px] bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={`rounded-[12px] border px-3 py-2.5 text-left transition-colors ${
                mode === option.value
                  ? 'border-[#2563EB] bg-[#EEF4FF] dark:border-blue-500 dark:bg-blue-950/40'
                  : 'border-[rgba(75,120,220,0.12)] bg-white hover:bg-[#F8FBFF] dark:border-white/10 dark:bg-slate-900/70 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                {option.value === 'single' ? (
                  <User className="size-4 text-[#2563EB]" />
                ) : (
                  <Users className="size-4 text-[#2563EB]" />
                )}
                <span className="text-sm font-semibold text-[#2A376F] dark:text-slate-100">{option.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
            </button>
          ))}
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!weekStart || isSaving) return

            if (mode === 'single') {
              if (!driverId) return
              onCreateSingle(driverId, weekStart)
              return
            }

            onCreateBulk(mode === 'allActive' ? 'allActive' : 'driversByRole', weekStart)
          }}
        >
          {mode === 'single' ? (
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Worker</span>
              <select
                value={driverId}
                onChange={(event) => setDriverId(event.target.value)}
                className={inputClassName}
                required
                disabled={drivers.length === 0 || isSaving}
              >
                {drivers.length === 0 ? (
                  <option value="">No workers available</option>
                ) : (
                  drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.firstName} {driver.lastName}
                      {driver.role ? ` · ${driver.role}` : ''}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <p className="rounded-[10px] bg-[#F8FBFF] px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
              {mode === 'allActive'
                ? `${activeDrivers.length} active workers will receive draft timesheets. Existing records for this week are skipped.`
                : `${activeDriverRoleCount} active drivers will receive draft timesheets. Existing records for this week are skipped.`}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Week</span>
            <Input
              type="date"
              value={weekStart}
              onChange={(event) =>
                setWeekStart(normalizeWeekStartForCompany(event.target.value))
              }
              className="mt-1.5 h-10 rounded-[12px] border-[rgba(75,120,220,0.12)] bg-[#F8FBFF] text-sm dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-100"
              required
              disabled={isSaving}
            />
            <div className="mt-1.5">
              <TimesheetWeekLabel
                weekTitle={weekDisplay.weekTitle}
                weekRangeLabel={weekDisplay.weekRangeLabel}
                titleClassName="text-xs font-semibold text-slate-700 dark:text-slate-200"
                rangeClassName="text-xs text-slate-500 dark:text-slate-400"
              />
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 rounded-[10px] px-3 text-sm font-semibold text-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSaving ||
                (mode === 'single' && drivers.length === 0) ||
                (mode === 'allActive' && activeDrivers.length === 0) ||
                (mode === 'driversByRole' && activeDriverRoleCount === 0)
              }
              className="h-9 rounded-[10px] bg-[#2563EB] px-3 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              {isSaving
                ? 'Creating…'
                : mode === 'single'
                  ? 'Create timesheet'
                  : 'Create weekly timesheets'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
