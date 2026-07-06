import { useHolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { formatDateFromIso, getWeekdayLabels } from '@/lib/dateTimeFormat'
import { normalizeHolidayIsoDate, toLocalIsoDate } from '@/lib/holidayRequestUtils'
import { cn } from '@/lib/utils'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

/** Holiday date pickers always use Monday-first weeks. */
const HOLIDAY_WEEK_STARTS = 'monday' as const

type HolidayDateInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
  required?: boolean
  min?: string
  'aria-label'?: string
  blurOnSelect?: boolean
  /** Full-width popover for use inside modals. */
  layout?: 'default' | 'modal'
}

type CalendarDay = {
  date: Date
  iso: string
  inMonth: boolean
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null
  const normalized = normalizeHolidayIsoDate(value)
  const date = new Date(`${normalized}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(year, month, 1 - startOffset)
  const grid: CalendarDay[] = []

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    grid.push({
      date,
      iso: toLocalIsoDate(date),
      inMonth: date.getMonth() === month,
    })
  }

  return grid
}

type DatePickerPanelProps = {
  viewDate: Date
  selectedIso: string
  min?: string
  layout: 'default' | 'modal'
  onSelect: (iso: string) => void
  onViewDateChange: (date: Date) => void
}

function DatePickerPanel({
  viewDate,
  selectedIso,
  min,
  layout,
  onSelect,
  onViewDateChange,
}: DatePickerPanelProps) {
  const weekdayLabels = getWeekdayLabels(HOLIDAY_WEEK_STARTS)
  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(viewDate)
  const days = useMemo(
    () => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate],
  )

  function moveMonth(delta: number) {
    const next = new Date(viewDate)
    next.setMonth(viewDate.getMonth() + delta)
    onViewDateChange(next)
  }

  return (
    <div className={cn('min-w-0', layout === 'modal' ? 'w-full' : 'w-[17rem] max-w-full')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => moveMonth(-1)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#0B68BE] transition-colors hover:bg-[#EEF6FF]"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="truncate text-sm font-semibold text-[#113C69]">{monthLabel}</p>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => moveMonth(1)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#0B68BE] transition-colors hover:bg-[#EEF6FF]"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[10px] font-bold uppercase tracking-[0.04em] text-[#5499BF]"
          >
            {label}
          </div>
        ))}
        {days.map((day) => {
          const isSelected = day.iso === selectedIso
          const isToday = day.iso === toLocalIsoDate(new Date())
          const isDisabled = min ? day.iso < min : false

          return (
            <button
              key={day.iso}
              type="button"
              disabled={isDisabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(day.iso)}
              className={cn(
                'h-8 rounded-[8px] text-xs font-medium tabular-nums transition-colors sm:h-9',
                isDisabled && 'cursor-not-allowed opacity-35',
                !isDisabled && !day.inMonth && 'text-[#A8C4DC]',
                !isDisabled && day.inMonth && 'text-[#113C69] hover:bg-[#EEF6FF]',
                isToday && !isSelected && !isDisabled && 'ring-1 ring-[#89CFF0]',
                isSelected && 'bg-[#218EE7] text-white hover:bg-[#1B7FD0]',
              )}
              aria-label={day.iso}
              aria-pressed={isSelected}
            >
              {day.date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function HolidayDateInput({
  value,
  onChange,
  className,
  id,
  required,
  min,
  'aria-label': ariaLabel,
  blurOnSelect = false,
  layout = 'default',
}: HolidayDateInputProps) {
  const { dateFormat } = useCompanySettings()
  const group = useHolidayDatePickerGroup()
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [localOpen, setLocalOpen] = useState(false)
  const selectedDate = parseIsoDate(value)
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date())

  const isOpen = group ? group.openId === pickerId : localOpen

  function setOpen(nextOpen: boolean) {
    if (group) {
      group.setOpenId(nextOpen ? pickerId : null)
      return
    }
    setLocalOpen(nextOpen)
  }

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate)
    }
  }, [value])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  function handleSelect(iso: string) {
    onChange(iso)
    setOpen(false)
    if (blurOnSelect) {
      inputRef.current?.blur()
    }
  }

  const displayValue = value ? formatDateFromIso(value, { dateFormat }) : ''

  return (
    <div ref={rootRef} className="relative min-w-0 w-full max-w-full" lang="en-GB">
      <div className="relative min-w-0">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          readOnly
          value={displayValue}
          placeholder="Select date"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          required={required}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          className={cn(className, 'min-w-0 max-w-full cursor-pointer pr-9')}
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen(!isOpen)
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5499BF]"
          aria-label={ariaLabel ? `${ariaLabel} calendar` : 'Open calendar'}
        >
          <Calendar className="size-4" />
        </button>
      </div>

      {isOpen ? (
        <div
          className={cn(
            'absolute z-[130] rounded-[12px] border border-[#D3E9FC] bg-white p-2.5 shadow-[0_12px_32px_rgba(11,38,70,0.14)] sm:p-3',
            layout === 'modal'
              ? 'left-0 right-0 top-[calc(100%+4px)] w-full max-w-full'
              : 'left-0 top-[calc(100%+4px)] w-[min(100%,17rem)]',
          )}
        >
          <DatePickerPanel
            viewDate={viewDate}
            selectedIso={value}
            min={min}
            layout={layout}
            onSelect={handleSelect}
            onViewDateChange={setViewDate}
          />
        </div>
      ) : null}
    </div>
  )
}
