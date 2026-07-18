import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CompanyTimeFormat } from '@/lib/dateTimeFormat'
import { formatClockTime, parseClockTime } from '@/lib/dateTimeFormat'
import { useEffect, useRef, useState } from 'react'

const ALL_MINUTES = Array.from({ length: 60 }, (_, index) => index)

type CompanyTimeInputProps = {
  value: string | null
  onChange: (value: string | null) => void
  timeFormat: CompanyTimeFormat
  minuteOptions?: readonly number[]
  className?: string
}

function normalizeClockValue(value: string): string | null {
  const parsed = parseClockTime(value)
  if (!parsed) return null
  return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`
}

function snapMinute(minute: number, minuteOptions: readonly number[]): number {
  return minuteOptions.reduce((closest, option) =>
    Math.abs(option - minute) < Math.abs(closest - minute) ? option : closest,
  )
}

function to12HourParts(
  value: string | null,
  minuteOptions: readonly number[],
): {
  hour: number
  minute: number
  period: 'AM' | 'PM'
} {
  const parsed = value ? parseClockTime(value) : null
  if (!parsed) {
    return { hour: 8, minute: minuteOptions[0] ?? 0, period: 'AM' }
  }

  const snapped = snapMinute(parsed.minutes, minuteOptions)
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

function to24HourParts(
  value: string | null,
  minuteOptions: readonly number[],
): { hour: number; minute: number } {
  const parsed = value ? parseClockTime(value) : null
  if (!parsed) return { hour: 8, minute: minuteOptions[0] ?? 0 }
  return { hour: parsed.hours, minute: snapMinute(parsed.minutes, minuteOptions) }
}

function formatInputDisplay(
  value: string | null,
  draft: string,
  isFocused: boolean,
  timeFormat: CompanyTimeFormat,
): string {
  if (isFocused) return draft
  if (!value?.trim()) return ''
  if (timeFormat === '12-hour') {
    return formatClockTime(value, { timeFormat })
  }
  return value.slice(0, 5)
}

type PickerPanelProps = {
  timeFormat: CompanyTimeFormat
  value: string | null
  minuteOptions: readonly number[]
  onSelect: (value: string) => void
}

function PickerPanel({ timeFormat, value, minuteOptions, onSelect }: PickerPanelProps) {
  if (timeFormat === '12-hour') {
    const parts = to12HourParts(value, minuteOptions)
    return (
      <div className="flex gap-2">
        <PickerColumn
          label="Hour"
          options={Array.from({ length: 12 }, (_, index) => index + 1)}
          selected={parts.hour}
          onSelect={(hour) => onSelect(from12HourParts(hour, parts.minute, parts.period))}
          format={(hour) => String(hour)}
        />
        <PickerColumn
          label="Min"
          options={minuteOptions}
          selected={parts.minute}
          onSelect={(minute) => onSelect(from12HourParts(parts.hour, minute, parts.period))}
          format={(minute) => String(minute).padStart(2, '0')}
        />
        <PickerColumn
          label="Period"
          options={['AM', 'PM'] as const}
          selected={parts.period}
          onSelect={(period) => onSelect(from12HourParts(parts.hour, parts.minute, period))}
          format={(period) => period}
        />
      </div>
    )
  }

  const parts = to24HourParts(value, minuteOptions)
  return (
    <div className="flex gap-2">
      <PickerColumn
        label="Hour"
        options={Array.from({ length: 24 }, (_, index) => index)}
        selected={parts.hour}
        onSelect={(hour) =>
          onSelect(`${String(hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`)
        }
        format={(hour) => String(hour).padStart(2, '0')}
      />
      <PickerColumn
        label="Min"
        options={minuteOptions}
        selected={parts.minute}
        onSelect={(minute) =>
          onSelect(`${String(parts.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
        }
        format={(minute) => String(minute).padStart(2, '0')}
      />
    </div>
  )
}

function PickerColumn<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  format,
}: {
  label: string
  options: readonly T[]
  selected: T
  onSelect: (value: T) => void
  format: (value: T) => string
}) {
  return (
    <div className="min-w-[52px]">
      <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-[#3D7A9C]">
        {label}
      </p>
      <div className="max-h-32 overflow-y-auto rounded-[8px] bg-[#F8FBFF] ring-1 ring-[#D3E9FC]">
        {options.map((option) => (
          <button
            key={String(option)}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(option)}
            className={cn(
              'block w-full px-2 py-1 text-center text-xs tabular-nums transition-colors',
              option === selected
                ? 'bg-[#218EE7] font-semibold text-white'
                : 'text-[#113C69] hover:bg-[#E8F3FE]',
            )}
          >
            {format(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CompanyTimeInput({
  value,
  onChange,
  timeFormat,
  minuteOptions = ALL_MINUTES,
  className,
}: CompanyTimeInputProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(value ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isInvalid, setIsInvalid] = useState(false)

  useEffect(() => {
    setDraft(value ?? '')
    setIsInvalid(false)
  }, [value])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
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

    setDraft(normalized)
    onChange(normalized)
    setIsInvalid(false)
  }

  function handlePickerSelect(nextValue: string) {
    setDraft(nextValue)
    onChange(nextValue)
    setIsInvalid(false)
    setIsOpen(false)
    setIsFocused(false)
  }

  const placeholder = timeFormat === '12-hour' ? 'e.g. 2:30 PM' : 'HH:mm'
  const displayValue = formatInputDisplay(value, draft, isFocused, timeFormat)

  return (
    <div ref={rootRef} className="relative w-full">
      <Input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        autoComplete="off"
        value={displayValue}
        onChange={(event) => {
          setDraft(event.target.value)
          setIsInvalid(false)
        }}
        onFocus={() => {
          setIsFocused(true)
          setDraft(value ?? '')
          setIsOpen(true)
        }}
        onClick={() => setIsOpen(true)}
        onBlur={() => {
          setIsFocused(false)
          commitDraft(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraft(draft)
            setIsOpen(false)
            setIsFocused(false)
          }
          if (event.key === 'Escape') {
            setIsOpen(false)
            setIsFocused(false)
            setDraft(value ?? '')
          }
        }}
        aria-invalid={isInvalid}
        aria-expanded={isOpen}
        className={cn(className, isInvalid && 'ring-2 ring-rose-200')}
      />

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-[60] rounded-[10px] border border-[#D3E9FC] bg-white p-2 shadow-[0_12px_32px_rgba(11,38,70,0.14)] dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40">
          <PickerPanel
            timeFormat={timeFormat}
            value={draft || value}
            minuteOptions={minuteOptions}
            onSelect={handlePickerSelect}
          />
        </div>
      ) : null}
    </div>
  )
}
