import { useHolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { Input } from '@/components/ui/input'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { formatDateFromIso, getWeekdayLabels } from '@/lib/dateTimeFormat'
import { normalizeHolidayIsoDate, toLocalIsoDate } from '@/lib/holidayRequestUtils'
import { cn } from '@/lib/utils'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

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
  /** When true and a value is set, show an accessible clear control. */
  clearable?: boolean
  /** Full-width popover for use inside modals. */
  layout?: 'default' | 'modal'
  /** Horizontal alignment of the calendar popover relative to the input. */
  popoverAlign?: 'start' | 'end'
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
    <div className={cn('min-w-0', layout === 'modal' ? 'w-full' : 'w-full')}>
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
        <p className="truncate text-sm font-semibold text-[#113C69] dark:text-slate-100">{monthLabel}</p>
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

      {/* Fixed 7-column grid — parent must be wide enough for 3-letter weekday labels. */}
      <div className="grid w-full grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="flex h-7 min-w-0 items-center justify-center text-[10px] font-semibold uppercase leading-none tracking-wide text-[#5499BF]"
          >
            <span className="block w-full truncate text-center">{label}</span>
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
                !isDisabled && day.inMonth && 'text-[#113C69] hover:bg-[#EEF6FF] dark:text-slate-100 dark:hover:bg-slate-800/50',
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
  clearable = false,
  layout = 'default',
  popoverAlign = 'start',
}: HolidayDateInputProps) {
  const { dateFormat } = useCompanySettings()
  const group = useHolidayDatePickerGroup()
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [localOpen, setLocalOpen] = useState(false)
  const [popoverOffset, setPopoverOffset] = useState({ x: 0, y: 0 })
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
    if (!isOpen) {
      setPopoverOffset({ x: 0, y: 0 })
      return
    }

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

  // Keep the calendar fully inside the viewport without shrinking weekday columns.
  useLayoutEffect(() => {
    if (!isOpen || layout === 'modal') {
      setPopoverOffset({ x: 0, y: 0 })
      return
    }

    const popover = popoverRef.current
    if (!popover) return

    // Measure the untransformed box so month navigation does not compound shifts.
    const previousTransform = popover.style.transform
    popover.style.transform = 'none'
    const rect = popover.getBoundingClientRect()
    popover.style.transform = previousTransform

    const pad = 8
    let shiftX = 0
    let shiftY = 0

    if (rect.right > window.innerWidth - pad) {
      shiftX = window.innerWidth - pad - rect.right
    }
    if (rect.left + shiftX < pad) {
      shiftX += pad - (rect.left + shiftX)
    }
    if (rect.bottom > window.innerHeight - pad) {
      shiftY = window.innerHeight - pad - rect.bottom
    }
    if (rect.top + shiftY < pad) {
      shiftY += pad - (rect.top + shiftY)
    }

    setPopoverOffset({ x: shiftX, y: shiftY })
  }, [isOpen, layout, viewDate, popoverAlign])

  function handleSelect(iso: string) {
    onChange(iso)
    setOpen(false)
    if (blurOnSelect) {
      inputRef.current?.blur()
    }
  }

  const displayValue = value ? formatDateFromIso(value, { dateFormat }) : ''
  const showClear = clearable && value.length > 0
  const clearLabel = ariaLabel ? `Clear ${ariaLabel}` : 'Clear date'

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
          className={cn(
            className,
            'min-w-0 max-w-full cursor-pointer',
            showClear ? 'pr-14' : 'pr-9',
          )}
        />
        {showClear ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onChange('')
              setOpen(false)
            }}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded-[6px] p-0.5 text-[#5499BF] transition-colors hover:bg-[#EEF6FF] hover:text-[#0B68BE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 dark:hover:bg-slate-800"
            aria-label={clearLabel}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
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
          ref={popoverRef}
          className={cn(
            'absolute z-[130] rounded-[12px] border border-[#D3E9FC] bg-white p-2.5 shadow-[0_12px_32px_rgba(11,38,70,0.14)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 sm:p-3',
            layout === 'modal'
              ? 'left-0 right-0 top-[calc(100%+4px)] w-full max-w-full'
              : cn(
                  // Fixed calendar width so 7 weekday labels never compress inside narrow filter columns.
                  'top-[calc(100%+4px)] w-[min(17.5rem,calc(100vw-1.5rem))]',
                  popoverAlign === 'end' ? 'right-0 left-auto' : 'left-0',
                ),
          )}
          style={
            layout === 'modal' || (popoverOffset.x === 0 && popoverOffset.y === 0)
              ? undefined
              : { transform: `translate(${popoverOffset.x}px, ${popoverOffset.y}px)` }
          }
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
