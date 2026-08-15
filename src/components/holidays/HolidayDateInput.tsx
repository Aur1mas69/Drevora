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

export type HolidayDateInputChrome = {
  locale?: string
  weekdayLabels?: readonly string[]
  previousMonth?: string
  nextMonth?: string
  selectDate?: string
  clearDate?: string
  openCalendar?: string
  namedCalendar?: (label: string) => string
  clearNamedDate?: (label: string) => string
}

type HolidayDateInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  id?: string
  required?: boolean
  min?: string
  'aria-label'?: string
  /** When true, open the calendar (e.g. after picking the start date in a range). */
  requestOpen?: boolean
  onRequestOpenHandled?: () => void
  blurOnSelect?: boolean
  /** When true and a value is set, show an accessible clear control. */
  clearable?: boolean
  /** Full-width popover for use inside modals. */
  layout?: 'default' | 'modal'
  /** Horizontal alignment of the calendar popover relative to the input. */
  popoverAlign?: 'start' | 'end'
  /** Worker-only labels/locale. Admin keeps English defaults when omitted. */
  chrome?: HolidayDateInputChrome
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
  chrome?: HolidayDateInputChrome
}

function DatePickerPanel({
  viewDate,
  selectedIso,
  min,
  layout,
  onSelect,
  onViewDateChange,
  chrome,
}: DatePickerPanelProps) {
  const weekdayLabels = chrome?.weekdayLabels ?? getWeekdayLabels(HOLIDAY_WEEK_STARTS)
  const monthLabel = new Intl.DateTimeFormat(chrome?.locale ?? 'en-GB', {
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
    <div className={cn('my-holiday-datepicker min-w-0', layout === 'modal' ? 'w-full' : 'w-full')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => moveMonth(-1)}
          className="my-holiday-nav inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#0B68BE] transition-colors hover:bg-[#EEF6FF]"
          aria-label={chrome?.previousMonth ?? 'Previous month'}
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="my-holiday-body truncate text-sm font-semibold text-[#113C69] dark:text-slate-100">{monthLabel}</p>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => moveMonth(1)}
          className="my-holiday-nav inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#0B68BE] transition-colors hover:bg-[#EEF6FF]"
          aria-label={chrome?.nextMonth ?? 'Next month'}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Fixed 7-column grid — parent must be wide enough for 3-letter weekday labels. */}
      <div className="grid w-full grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="my-holiday-weekday flex h-7 min-w-0 items-center justify-center text-[10px] font-semibold uppercase leading-none tracking-wide text-[#5499BF]"
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
                'my-holiday-day h-8 rounded-[8px] text-xs font-medium tabular-nums transition-colors sm:h-9',
                isDisabled && 'cursor-not-allowed opacity-35',
                !isDisabled && !day.inMonth && 'text-[#A8C4DC]',
                !isDisabled && day.inMonth && 'text-[#113C69] hover:bg-[#EEF6FF] dark:text-slate-100 dark:hover:bg-slate-800/50',
                isToday && !isSelected && !isDisabled && 'ring-1 ring-[#89CFF0]',
                isSelected && 'my-holiday-day-selected bg-[#218EE7] text-white hover:bg-[#1B7FD0]',
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
  requestOpen = false,
  onRequestOpenHandled,
  chrome,
}: HolidayDateInputProps) {
  const { dateFormat } = useCompanySettings()
  const group = useHolidayDatePickerGroup()
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [localOpen, setLocalOpen] = useState(false)
  const [popoverOffset, setPopoverOffset] = useState({ x: 0, y: 0 })
  const [popoverPlacement, setPopoverPlacement] = useState<'below' | 'above'>('below')
  const selectedDate = parseIsoDate(value)
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date())
  /**
   * Selecting a day closes the calendar, but the same tap can re-open it: the
   * input sits inside a <label>, so activation is forwarded back to the input
   * (focus + click). Ignore user-driven opens for a moment after a selection.
   */
  const suppressOpenUntilRef = useRef(0)

  const isOpen = group ? group.openId === pickerId : localOpen

  function setOpen(nextOpen: boolean) {
    if (group) {
      group.setOpenId(nextOpen ? pickerId : null)
      return
    }
    setLocalOpen(nextOpen)
  }

  function openFromUser() {
    if (Date.now() < suppressOpenUntilRef.current) return
    setOpen(true)
  }

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate)
    }
  }, [value])

  const onRequestOpenHandledRef = useRef(onRequestOpenHandled)
  onRequestOpenHandledRef.current = onRequestOpenHandled

  useEffect(() => {
    if (!requestOpen) return
    suppressOpenUntilRef.current = 0
    setOpen(true)
    onRequestOpenHandledRef.current?.()
  }, [requestOpen])

  useEffect(() => {
    if (!isOpen) {
      setPopoverOffset({ x: 0, y: 0 })
      setPopoverPlacement('below')
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    // Defer so the same tap/click that opened the picker does not immediately close it.
    const frame = window.requestAnimationFrame(() => {
      window.addEventListener('pointerdown', handlePointerDown)
      window.addEventListener('keydown', handleKeyDown)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Keep the calendar fully inside the viewport without shrinking weekday columns.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPopoverOffset({ x: 0, y: 0 })
      setPopoverPlacement('below')
      return
    }

    const popover = popoverRef.current
    const anchor = rootRef.current
    if (!popover || !anchor) return

    // Measure the untransformed box so month navigation does not compound shifts.
    const previousTransform = popover.style.transform
    popover.style.transform = 'none'
    const rect = popover.getBoundingClientRect()
    popover.style.transform = previousTransform
    const anchorRect = anchor.getBoundingClientRect()

    const pad = 8
    let shiftX = 0
    let shiftY = 0
    let placement: 'below' | 'above' = 'below'

    const spaceBelow = window.innerHeight - anchorRect.bottom
    const spaceAbove = anchorRect.top
    if (layout === 'modal' && rect.height + pad > spaceBelow && spaceAbove > spaceBelow) {
      placement = 'above'
    }

    if (rect.right > window.innerWidth - pad) {
      shiftX = window.innerWidth - pad - rect.right
    }
    if (rect.left + shiftX < pad) {
      shiftX += pad - (rect.left + shiftX)
    }

    if (placement === 'below') {
      if (rect.bottom > window.innerHeight - pad) {
        shiftY = window.innerHeight - pad - rect.bottom
      }
      if (rect.top + shiftY < pad) {
        shiftY += pad - (rect.top + shiftY)
      }
    } else if (rect.top < pad) {
      shiftY = pad - rect.top
    }

    setPopoverPlacement(placement)
    setPopoverOffset({ x: shiftX, y: shiftY })
  }, [isOpen, layout, viewDate, popoverAlign])

  function handleSelect(iso: string) {
    suppressOpenUntilRef.current = Date.now() + 400
    setOpen(false)
    onChange(iso)
    if (blurOnSelect) {
      inputRef.current?.blur()
    }
  }

  const displayValue = value ? formatDateFromIso(value, { dateFormat }) : ''
  const showClear = clearable && value.length > 0
  const clearLabel = ariaLabel
    ? (chrome?.clearNamedDate?.(ariaLabel) ?? `Clear ${ariaLabel}`)
    : (chrome?.clearDate ?? 'Clear date')

  return (
    <div ref={rootRef} className="relative min-w-0 w-full max-w-full" lang={chrome?.locale ?? 'en-GB'}>
      <div className="relative min-w-0">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          readOnly
          value={displayValue}
          placeholder={chrome?.selectDate ?? 'Select date'}
          onFocus={openFromUser}
          onClick={openFromUser}
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
              suppressOpenUntilRef.current = Date.now() + 400
              setOpen(false)
              onChange('')
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
          onClick={(event) => {
            event.stopPropagation()
            if (isOpen) {
              suppressOpenUntilRef.current = Date.now() + 400
              setOpen(false)
              return
            }
            suppressOpenUntilRef.current = 0
            setOpen(true)
            inputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5499BF]"
          aria-label={
            ariaLabel
              ? (chrome?.namedCalendar?.(ariaLabel) ?? `${ariaLabel} calendar`)
              : (chrome?.openCalendar ?? 'Open calendar')
          }
        >
          <Calendar className="size-4" />
        </button>
      </div>

      {isOpen ? (
        <div
          ref={popoverRef}
          className={cn(
            'my-holiday-datepicker-popover absolute z-[130] rounded-[12px] border border-[#D3E9FC] bg-white p-2.5 shadow-[0_12px_32px_rgba(11,38,70,0.14)] dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40 sm:p-3',
            layout === 'modal'
              ? cn(
                  'left-0 right-0 w-full max-w-full',
                  popoverPlacement === 'above'
                    ? 'bottom-[calc(100%+4px)] top-auto'
                    : 'top-[calc(100%+4px)]',
                )
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
            chrome={chrome}
          />
        </div>
      ) : null}
    </div>
  )
}
