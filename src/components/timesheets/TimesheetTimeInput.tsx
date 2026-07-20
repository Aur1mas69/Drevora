import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import { parseClockTime } from '@/lib/dateTimeFormat'
import { useEffect, useRef, useState } from 'react'

/** Timesheet shifts use half-hour increments only. */
const MINUTE_OPTIONS = [0, 30] as const

type TimesheetTimeInputProps = {
  value: string | null
  onChange: (value: string | null) => void
  timeFormat: CompanyTimeFormat
  className?: string
  'data-entry-index'?: number
  'data-field'?: string
}

type PickerStep = 'hour' | 'minute'

function normalizeClockValue(value: string): string | null {
  const parsed = parseClockTime(value)
  if (!parsed) return null
  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`
}

function snapMinute(minute: number): number {
  return MINUTE_OPTIONS.reduce((closest, option) =>
    Math.abs(option - minute) < Math.abs(closest - minute) ? option : closest,
  )
}

function to12HourParts(value: string | null): {
  hour: number
  minute: number
  period: 'AM' | 'PM'
} {
  const parsed = value ? parseClockTime(value) : null
  if (!parsed) {
    return { hour: 8, minute: 0, period: 'AM' }
  }

  const snapped = snapMinute(parsed.minutes)
  let hour12 = parsed.hours % 12
  if (hour12 === 0) hour12 = 12
  const period: 'AM' | 'PM' = parsed.hours >= 12 ? 'PM' : 'AM'
  return { hour: hour12, minute: snapped, period }
}

function from12HourParts(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let hours = hour12 % 12
  if (period === 'PM') hours += 12
  return `${String(hours).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function to24HourParts(value: string | null): { hour: number; minute: number } {
  const parsed = value ? parseClockTime(value) : null
  if (!parsed) return { hour: 8, minute: 0 }
  return { hour: parsed.hours, minute: snapMinute(parsed.minutes) }
}

function formatClock(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

type PickerPanelProps = {
  timeFormat: CompanyTimeFormat
  step: PickerStep
  pendingHour: number
  pendingMinute: number
  pendingPeriod: 'AM' | 'PM'
  onHourSelect: (hour: number) => void
  onMinuteSelect: (minute: number) => void
  onPeriodSelect: (period: 'AM' | 'PM') => void
  onBackToHour: () => void
}

function PickerPanel({
  timeFormat,
  step,
  pendingHour,
  pendingMinute,
  pendingPeriod,
  onHourSelect,
  onMinuteSelect,
  onPeriodSelect,
  onBackToHour,
}: PickerPanelProps) {
  if (timeFormat === '12-hour') {
    return (
      <div className="space-y-2">
        <PickerStepHeader
          step={step}
          summary={
            step === 'minute'
              ? `${pendingHour}:${String(pendingMinute).padStart(2, '0')} ${pendingPeriod}`
              : null
          }
          onBackToHour={onBackToHour}
        />
        {step === 'hour' ? (
          <PickerColumn
            label="Hour"
            options={Array.from({ length: 12 }, (_, index) => index + 1)}
            selected={pendingHour}
            onSelect={onHourSelect}
            format={(hour) => String(hour)}
            wide
          />
        ) : (
          <div className="flex gap-2.5">
            <PickerColumn
              label="Min"
              options={[...MINUTE_OPTIONS]}
              selected={pendingMinute}
              onSelect={onMinuteSelect}
              format={(minute) => String(minute).padStart(2, '0')}
            />
            <PickerColumn
              label="Period"
              options={['AM', 'PM'] as const}
              selected={pendingPeriod}
              onSelect={onPeriodSelect}
              format={(period) => period}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <PickerStepHeader
        step={step}
        summary={
          step === 'minute'
            ? formatClock(pendingHour, pendingMinute)
            : null
        }
        onBackToHour={onBackToHour}
      />
      {step === 'hour' ? (
        <PickerColumn
          label="Hour"
          options={Array.from({ length: 24 }, (_, index) => index)}
          selected={pendingHour}
          onSelect={onHourSelect}
          format={(hour) => String(hour).padStart(2, '0')}
          wide
        />
      ) : (
        <PickerColumn
          label="Min"
          options={[...MINUTE_OPTIONS]}
          selected={pendingMinute}
          onSelect={onMinuteSelect}
          format={(minute) => String(minute).padStart(2, '0')}
          wide
        />
      )}
    </div>
  )
}

function PickerStepHeader({
  step,
  summary,
  onBackToHour,
}: {
  step: PickerStep
  summary: string | null
  onBackToHour: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {step === 'hour' ? 'Select hour' : 'Select minutes'}
      </p>
      {step === 'minute' ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onBackToHour}
          className="text-[10px] font-semibold text-[#2563EB] hover:text-[#1d4ed8]"
        >
          {summary ? `Hour ${summary.split(':')[0]}` : 'Hour'}
        </button>
      ) : null}
    </div>
  )
}

function PickerColumn<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  format,
  wide = false,
}: {
  label: string
  options: readonly T[]
  selected: T
  onSelect: (value: T) => void
  format: (value: T) => string
  wide?: boolean
}) {
  return (
    <div className={cn(wide ? 'min-w-[72px]' : 'min-w-[60px]')}>
      <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <div
        className={cn(
          'overflow-y-auto rounded-[10px] bg-[#F8FBFF] ring-1 ring-[rgba(75,120,220,0.10)]',
          wide ? 'max-h-40' : 'max-h-36',
        )}
      >
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(option)}
            className={cn(
              'block w-full px-2.5 py-1.5 text-center text-sm tabular-nums transition-colors',
              option === selected
                ? 'bg-[#2563EB] font-semibold text-white'
                : 'text-slate-700 hover:bg-white',
            )}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TimesheetTimeInput({
  value,
  onChange,
  timeFormat,
  className,
  ...dataAttrs
}: TimesheetTimeInputProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(value ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [isInvalid, setIsInvalid] = useState(false)
  const [step, setStep] = useState<PickerStep>('hour')
  const [pendingHour, setPendingHour] = useState(8)
  const [pendingMinute, setPendingMinute] = useState(0)
  const [pendingPeriod, setPendingPeriod] = useState<'AM' | 'PM'>('AM')

  useEffect(() => {
    setDraft(value ?? '')
    setIsInvalid(false)
  }, [value])

  function resetPendingFromValue(nextValue: string | null) {
    if (timeFormat === '12-hour') {
      const parts = to12HourParts(nextValue)
      setPendingHour(parts.hour)
      setPendingMinute(parts.minute)
      setPendingPeriod(parts.period)
    } else {
      const parts = to24HourParts(nextValue)
      setPendingHour(parts.hour)
      setPendingMinute(parts.minute)
    }
    setStep('hour')
  }

  function openPicker() {
    setIsOpen((wasOpen) => {
      if (!wasOpen) {
        resetPendingFromValue(draft || value)
      }
      return true
    })
  }

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setStep('hour')
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
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

    const parsed = parseClockTime(normalized)
    if (!parsed) {
      setIsInvalid(true)
      return
    }

    const snapped = formatClock(parsed.hours, snapMinute(parsed.minutes))
    setDraft(snapped)
    onChange(snapped)
    setIsInvalid(false)
  }

  function handleHourSelect(hour: number) {
    setPendingHour(hour)
    setPendingMinute(0)
    setStep('minute')
    // Preview hour with :00 in the input only — commit after minute selection.
    if (timeFormat === '12-hour') {
      setDraft(from12HourParts(hour, 0, pendingPeriod))
    } else {
      setDraft(formatClock(hour, 0))
    }
    setIsInvalid(false)
  }

  function handleMinuteSelect(minute: number) {
    setPendingMinute(minute)
    const nextValue =
      timeFormat === '12-hour'
        ? from12HourParts(pendingHour, minute, pendingPeriod)
        : formatClock(pendingHour, minute)
    setDraft(nextValue)
    onChange(nextValue)
    setIsInvalid(false)
    setIsOpen(false)
    setStep('hour')
  }

  function handlePeriodSelect(period: 'AM' | 'PM') {
    setPendingPeriod(period)
    setDraft(from12HourParts(pendingHour, pendingMinute, period))
    setIsInvalid(false)
  }

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
        onBlur={() => commitDraft(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraft(draft)
            setIsOpen(false)
            setStep('hour')
          }
          if (event.key === 'Escape') {
            setIsOpen(false)
            setStep('hour')
          }
        }}
        aria-invalid={isInvalid}
        aria-expanded={isOpen}
        className={cn(className, isInvalid && 'ring-2 ring-rose-200')}
        {...dataAttrs}
      />

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-w-[min(18rem,calc(100vw-1.5rem))] rounded-[12px] border border-[rgba(75,120,220,0.12)] bg-white p-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          <PickerPanel
            timeFormat={timeFormat}
            step={step}
            pendingHour={pendingHour}
            pendingMinute={pendingMinute}
            pendingPeriod={pendingPeriod}
            onHourSelect={handleHourSelect}
            onMinuteSelect={handleMinuteSelect}
            onPeriodSelect={handlePeriodSelect}
            onBackToHour={() => setStep('hour')}
          />
        </div>
      ) : null}
    </div>
  )
}
