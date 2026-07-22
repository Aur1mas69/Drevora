import { Input } from '@/components/ui/input'
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

function normalizeClockValue(value: string): string | null {
  const parsed = parseClockTime(value)
  if (!parsed) return null
  return formatClock(parsed.hours, parsed.minutes)
}

function clampDigits(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLength)
}

function parseHourDraft(raw: string): number | null {
  if (!raw.trim()) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > 23) return null
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

/**
 * Compact 24-hour timesheet clock control.
 * HH and MM stay visible together — no long scroll lists, minutes 00–59.
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
  const hourRef = useRef<HTMLInputElement>(null)
  const panelId = useId()
  const [draft, setDraft] = useState(value ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [isInvalid, setIsInvalid] = useState(false)
  const [hourText, setHourText] = useState('')
  const [minuteText, setMinuteText] = useState('')
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM')
  const [panelError, setPanelError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(value ?? '')
    setIsInvalid(false)
  }, [value])

  function syncPanelFromValue(nextValue: string | null) {
    const parsed = nextValue ? parseClockTime(nextValue) : null
    if (!parsed) {
      setHourText('')
      setMinuteText('')
      setPeriod('AM')
      setPanelError(null)
      return
    }

    if (timeFormat === '12-hour') {
      const parts = to12HourParts(parsed.hours)
      setHourText(String(parts.hour))
      setPeriod(parts.period)
    } else {
      setHourText(String(parsed.hours).padStart(2, '0'))
    }
    setMinuteText(String(parsed.minutes).padStart(2, '0'))
    setPanelError(null)
  }

  function openPicker() {
    setIsOpen((wasOpen) => {
      if (!wasOpen) {
        syncPanelFromValue(draft || value)
        window.setTimeout(() => hourRef.current?.focus(), 0)
      }
      return true
    })
  }

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setPanelError(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('touchstart', handlePointerDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  function commitDraft(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) {
      onChange(null)
      setDraft('')
      setIsInvalid(false)
      return
    }

    const normalized = normalizeClockValue(trimmed)
    if (!normalized) {
      setIsInvalid(true)
      return
    }

    setDraft(normalized)
    onChange(normalized)
    setIsInvalid(false)
  }

  function resolveHour24(): number | null {
    if (timeFormat === '12-hour') {
      const hour12 = Number(hourText)
      if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12) return null
      return from12HourParts(hour12, period)
    }
    return parseHourDraft(hourText)
  }

  function handleConfirm() {
    const hour24 = resolveHour24()
    const minute = parseMinuteDraft(minuteText)

    if (hour24 === null || minute === null) {
      setPanelError('Enter a valid time (HH 00–23, MM 00–59).')
      setIsInvalid(true)
      return
    }

    const nextValue = formatClock(hour24, minute)
    setDraft(nextValue)
    onChange(nextValue)
    setIsInvalid(false)
    setPanelError(null)
    setIsOpen(false)
  }

  function handleClear() {
    setHourText('')
    setMinuteText('')
    setPeriod('AM')
    setDraft('')
    onChange(null)
    setIsInvalid(false)
    setPanelError(null)
    setIsOpen(false)
  }

  const showInvalid = invalid || isInvalid

  return (
    <div ref={rootRef} className="relative min-w-[72px]">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="HH:mm"
        autoComplete="off"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setIsInvalid(false)
        }}
        onFocus={openPicker}
        onClick={openPicker}
        onBlur={() => {
          // Commit typed HH:mm only when the panel is closed.
          if (!isOpen) commitDraft(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (isOpen) {
              handleConfirm()
            } else {
              commitDraft(draft)
            }
          }
          if (event.key === 'Escape') {
            setIsOpen(false)
            setPanelError(null)
            setDraft(value ?? '')
          }
        }}
        aria-invalid={showInvalid}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={cn(className, showInvalid && 'ring-2 ring-rose-200')}
        {...dataAttrs}
      />

      {isOpen ? (
        <div
          id={panelId}
          className="absolute left-0 top-[calc(100%+4px)] z-50 w-[min(18.5rem,calc(100vw-1.5rem))] rounded-[14px] border border-[rgba(75,120,220,0.14)] bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-slate-900"
          role="dialog"
          aria-label="Enter time"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Enter time
          </p>

          <div className="mt-2.5 flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1">
              <span className="block text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                HH
              </span>
              <input
                ref={hourRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder={timeFormat === '12-hour' ? '08' : '06'}
                value={hourText}
                onChange={(event) => {
                  setHourText(clampDigits(event.target.value, 2))
                  setPanelError(null)
                  setIsInvalid(false)
                }}
                className="h-12 w-full rounded-[12px] border border-slate-200 bg-[#F8FBFF] text-center text-lg font-semibold tabular-nums text-slate-950 outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/25"
                aria-label="Hours"
              />
            </label>

            <span className="pb-2.5 text-xl font-bold text-slate-400" aria-hidden>
              :
            </span>

            <label className="min-w-0 flex-1 space-y-1">
              <span className="block text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                MM
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="05"
                value={minuteText}
                onChange={(event) => {
                  setMinuteText(clampDigits(event.target.value, 2))
                  setPanelError(null)
                  setIsInvalid(false)
                }}
                className="h-12 w-full rounded-[12px] border border-slate-200 bg-[#F8FBFF] text-center text-lg font-semibold tabular-nums text-slate-950 outline-none focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/25"
                aria-label="Minutes"
              />
            </label>

            {timeFormat === '12-hour' ? (
              <div className="flex shrink-0 flex-col gap-1 pb-0.5">
                {(['AM', 'PM'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setPeriod(option)
                      setPanelError(null)
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

          {panelError ? (
            <p className="mt-2 text-xs font-medium text-rose-600">{panelError}</p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">
              Hours 00–23 · Minutes 00–59
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className="h-10 rounded-[12px] border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleConfirm}
              className="h-10 rounded-[12px] bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
