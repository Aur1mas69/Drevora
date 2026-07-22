import { cn } from '@/lib/utils'
import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import { parseClockTime } from '@/lib/dateTimeFormat'
import { useEffect, useId, useRef, useState } from 'react'

type TimesheetTimeInputProps = {
  value: string | null
  onChange: (value: string | null) => void
  timeFormat: CompanyTimeFormat
  className?: string
  invalid?: boolean
  'data-entry-index'?: number
  'data-field'?: string
}

function formatClock(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function digitsOnly(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLength)
}

function parseHourDraft(raw: string, timeFormat: CompanyTimeFormat): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  if (!Number.isInteger(value)) return null
  if (timeFormat === '12-hour') {
    if (value < 1 || value > 12) return null
    return value
  }
  if (value < 0 || value > 23) return null
  return value
}

function parseMinuteDraft(raw: string): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 59) return null
  return value
}

function to12HourParts(hour24: number): { hour: number; period: 'AM' | 'PM' } {
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  return { hour: hour12, period }
}

function from12HourParts(hour12: number, period: 'AM' | 'PM'): number {
  let hours = hour12 % 12
  if (period === 'PM') hours += 12
  return hours
}

function splitValue(
  value: string | null,
  timeFormat: CompanyTimeFormat,
): { hourText: string; minuteText: string; period: 'AM' | 'PM' } {
  const parsed = value ? parseClockTime(value) : null
  if (!parsed) {
    return { hourText: '', minuteText: '', period: 'AM' }
  }

  if (timeFormat === '12-hour') {
    const parts = to12HourParts(parsed.hours)
    return {
      hourText: String(parts.hour).padStart(2, '0'),
      minuteText: String(parsed.minutes).padStart(2, '0'),
      period: parts.period,
    }
  }

  return {
    hourText: String(parsed.hours).padStart(2, '0'),
    minuteText: String(parsed.minutes).padStart(2, '0'),
    period: 'AM',
  }
}

function formatDisplayValue(
  value: string | null,
  timeFormat: CompanyTimeFormat,
): string {
  const parts = splitValue(value, timeFormat)
  if (!parts.hourText || !parts.minuteText) return ''
  if (timeFormat === '12-hour') {
    return `${parts.hourText}:${parts.minuteText} ${parts.period}`
  }
  return `${parts.hourText}:${parts.minuteText}`
}

/**
 * Mobile-first timesheet clock: compact trigger + viewport-safe editor panel.
 * HH/MM are separate numeric fields; ":" is visual only.
 */
export function TimesheetTimeInput({
  value,
  onChange,
  timeFormat,
  className,
  invalid = false,
  ...dataAttrs
}: TimesheetTimeInputProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLInputElement>(null)
  const minuteRef = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  const [hourText, setHourText] = useState('')
  const [minuteText, setMinuteText] = useState('')
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM')
  const [isEditing, setIsEditing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  /** Distance from viewport bottom so the panel stays above the software keyboard. */
  const [panelBottom, setPanelBottom] = useState(12)

  useEffect(() => {
    if (isEditing) return
    const parts = splitValue(value, timeFormat)
    setHourText(parts.hourText)
    setMinuteText(parts.minuteText)
    setPeriod(parts.period)
    setLocalError(null)
  }, [value, timeFormat, isEditing])

  useEffect(() => {
    if (!isEditing) return

    function updatePanelPosition() {
      const vv = window.visualViewport
      if (!vv) {
        setPanelBottom(12)
        return
      }
      // Keep panel inside the visible viewport when the keyboard is open.
      const obscured = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height))
      setPanelBottom(Math.max(12, obscured + 12))
    }

    updatePanelPosition()
    const vv = window.visualViewport
    vv?.addEventListener('resize', updatePanelPosition)
    vv?.addEventListener('scroll', updatePanelPosition)
    window.addEventListener('resize', updatePanelPosition)

    window.setTimeout(() => hourRef.current?.focus(), 0)

    return () => {
      vv?.removeEventListener('resize', updatePanelPosition)
      vv?.removeEventListener('scroll', updatePanelPosition)
      window.removeEventListener('resize', updatePanelPosition)
    }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || rootRef.current?.contains(target)) {
        return
      }
      discardDraft()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isEditing, value, timeFormat])

  const hourValue = parseHourDraft(hourText, timeFormat)
  const minuteValue = parseMinuteDraft(minuteText)
  const canConfirm = hourValue !== null && minuteValue !== null
  const displayValue = formatDisplayValue(value, timeFormat)

  function resolveHour24(): number | null {
    if (hourValue === null) return null
    if (timeFormat === '12-hour') {
      return from12HourParts(hourValue, period)
    }
    return hourValue
  }

  function beginEditing() {
    if (isEditing) return
    const parts = splitValue(value, timeFormat)
    setHourText(parts.hourText)
    setMinuteText(parts.minuteText)
    setPeriod(parts.period)
    setLocalError(null)
    setIsEditing(true)
  }

  function discardDraft() {
    const parts = splitValue(value, timeFormat)
    setHourText(parts.hourText)
    setMinuteText(parts.minuteText)
    setPeriod(parts.period)
    setLocalError(null)
    setIsEditing(false)
  }

  function handleHourChange(raw: string) {
    const digits = digitsOnly(raw, 2)

    if (digits.length === 2) {
      const parsed = parseHourDraft(digits, timeFormat)
      if (parsed === null) {
        setLocalError(
          timeFormat === '12-hour'
            ? 'Hours must be 01–12.'
            : 'Hours must be 00–23.',
        )
        setHourText(digits.slice(0, 1))
        return
      }
      setHourText(String(parsed).padStart(2, '0'))
      setLocalError(null)
      window.setTimeout(() => minuteRef.current?.focus(), 0)
      return
    }

    setHourText(digits)
    setLocalError(null)
  }

  function handleMinuteChange(raw: string) {
    const digits = digitsOnly(raw, 2)

    if (digits.length === 2) {
      const parsed = parseMinuteDraft(digits)
      if (parsed === null) {
        setLocalError('Minutes must be 00–59.')
        setMinuteText(digits.slice(0, 1))
        return
      }
      setMinuteText(String(parsed).padStart(2, '0'))
      setLocalError(null)
      return
    }

    setMinuteText(digits)
    setLocalError(null)
  }

  function handleConfirm() {
    const hour24 = resolveHour24()
    const minute = parseMinuteDraft(minuteText)

    if (hour24 === null || minute === null) {
      setLocalError('Enter both hours and minutes.')
      return
    }

    const nextValue = formatClock(hour24, minute)
    const parts = splitValue(nextValue, timeFormat)
    setHourText(parts.hourText)
    setMinuteText(parts.minuteText)
    setPeriod(parts.period)
    onChange(nextValue)
    setLocalError(null)
    setIsEditing(false)
  }

  function handleClear() {
    setHourText('')
    setMinuteText('')
    setPeriod('AM')
    setLocalError(null)
    onChange(null)
    setIsEditing(false)
  }

  const panelInputClass =
    'h-12 w-full min-w-0 rounded-[12px] border border-slate-200 bg-[#F8FBFF] px-1 text-center text-lg font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-300 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/25'

  return (
    <div ref={rootRef} className="min-w-0 w-full max-w-full" {...dataAttrs}>
      <button
        type="button"
        onClick={beginEditing}
        aria-invalid={invalid}
        aria-expanded={isEditing}
        className={cn(
          'flex h-12 w-full min-w-0 max-w-full items-center justify-center truncate rounded-2xl border border-slate-200 bg-[#F8FBFF] px-2 text-sm font-semibold tabular-nums text-slate-950 outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20',
          !displayValue && 'text-slate-400',
          invalid && 'ring-2 ring-rose-200',
          className,
        )}
      >
        {displayValue || 'HH:MM'}
      </button>

      {isEditing ? (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/25"
          aria-hidden="true"
          onMouseDown={(event) => {
            event.preventDefault()
            discardDraft()
          }}
        />
      ) : null}

      {isEditing ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Enter time"
          className="fixed z-[90] w-auto max-w-[calc(100vw-24px)] rounded-[16px] border border-[rgba(75,120,220,0.16)] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-900"
          style={{
            left: 12,
            right: 12,
            bottom: panelBottom,
            maxHeight: 'min(320px, calc(100dvh - 24px))',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Enter time
          </p>

          <div className="mt-2 flex w-full min-w-0 items-center gap-1.5">
            <label className="min-w-0 flex-1 basis-0">
              <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                HH
              </span>
              <input
                ref={hourRef}
                id={`${fieldId}-hh`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={2}
                placeholder="00"
                value={hourText}
                onChange={(event) => handleHourChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (canConfirm) handleConfirm()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    discardDraft()
                  }
                }}
                aria-invalid={invalid || Boolean(localError)}
                className={panelInputClass}
              />
            </label>

            <span
              className="mt-5 shrink-0 select-none text-xl font-bold text-slate-400"
              aria-hidden="true"
            >
              :
            </span>

            <label className="min-w-0 flex-1 basis-0">
              <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                MM
              </span>
              <input
                ref={minuteRef}
                id={`${fieldId}-mm`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={2}
                placeholder="00"
                value={minuteText}
                onChange={(event) => handleMinuteChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (canConfirm) handleConfirm()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    discardDraft()
                  }
                }}
                aria-invalid={invalid || Boolean(localError)}
                className={panelInputClass}
              />
            </label>

            {timeFormat === '12-hour' ? (
              <div className="mt-5 flex shrink-0 flex-col gap-1">
                {(['AM', 'PM'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setPeriod(option)
                      setLocalError(null)
                    }}
                    className={cn(
                      'h-6 rounded-md px-2 text-[11px] font-semibold',
                      period === option
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {localError ? (
            <p className="mt-2 text-xs font-medium text-rose-600">{localError}</p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">
              Hours 00–23 · Minutes 00–59
            </p>
          )}

          <div className="mt-2.5 grid w-full min-w-0 grid-cols-2 gap-2">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className="h-10 min-w-0 rounded-[12px] border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={cn(
                'h-10 min-w-0 rounded-[12px] text-sm font-semibold text-white',
                canConfirm
                  ? 'bg-[#2563EB] hover:bg-[#1d4ed8]'
                  : 'cursor-not-allowed bg-slate-300',
              )}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
