import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FleetCalendarDayDetailsPanel } from '@/components/vehicles/FleetCalendarDayDetailsPanel'
import { calendarClassMap } from '@/components/vehicles/VehicleStatusBadge'
import { vehiclePanelClass, vehicleSelectClass } from '@/components/vehicles/vehicleUiStyles'
import {
  getAvailabilityRecordForDate,
} from '@/lib/vehicleAvailability'
import {
  type CalendarView,
  type PlanningEvent,
  buildFleetPlanningEvents,
  formatEventShortDate,
  formatMonthLabel,
  formatMonthYear,
  getEventsForDate,
  getEventsForMonth,
  getPlanningEventColor,
  getWeekDates,
  isPlanningEventEditable,
  planningEventColorMap,
  toDateKey,
} from '@/lib/vehiclePlanning'
import {
  getVehicleStatusForDate,
  vehiclesService,
  type Vehicle,
} from '@/services/vehiclesService'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, month) => ({
  value: month,
  label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, month, 1)),
}))

const calendarInputClass =
  'h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-3 text-sm font-semibold text-[#113C69] shadow-sm outline-none transition-colors hover:border-[#BFE3F5] focus:border-[#89CFF0] focus:ring-3 focus:ring-[#BFE3F5]/70 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-500/30'

type FleetCalendarDay = {
  date: Date
  iso: string
  label: string
  isToday: boolean
  isWeekend: boolean
  isCurrentMonth: boolean
  events: PlanningEvent[]
}

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatWeekHeader(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function addDaysLocal(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function getMonday(date: Date): Date {
  const dayOffset = (date.getDay() + 6) % 7
  return addDaysLocal(date, -dayOffset)
}

function isWeekendDate(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function getMonthGridRange(focusDate: Date): { start: string; end: string } {
  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
  const monthEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0)
  return {
    start: toDateKey(getMonday(monthStart)),
    end: toDateKey(addDaysLocal(getMonday(monthEnd), 6)),
  }
}

function getWeekRange(focusDate: Date): { start: string; end: string } {
  const start = getMonday(focusDate)
  return {
    start: toDateKey(start),
    end: toDateKey(addDaysLocal(start, 6)),
  }
}

function getWeekdayHeaderClass(isWeekend: boolean): string {
  if (isWeekend) {
    return 'rounded-[12px] border border-[#9CBEE0]/90 bg-gradient-to-b from-[#C5D9E8]/95 to-[#B3CBE0]/90 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#0B477F] shadow-sm'
  }

  return 'rounded-[12px] border border-[#D3E9FC]/70 bg-[#E8F5FF]/80 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#0B68BE]'
}

function getMonthCellBackgroundClass(
  hasEvents: boolean,
  isWeekend: boolean,
): string {
  if (!hasEvents) {
    if (isWeekend) {
      return 'border-[#9CBEE0] bg-gradient-to-br from-[#D4E4F0]/98 to-[#B8CFE0]/92'
    }
    return 'border-[#D3E9FC] bg-white/95 dark:border-white/10 dark:bg-slate-900/70'
  }

  if (isWeekend) {
    return 'border-[#9CBEE0] bg-gradient-to-br from-[#EEF6FF]/95 to-[#B8CFE0]/88'
  }

  return 'border-[#C5DFFB] bg-gradient-to-br from-[#F8FBFF]/98 to-[#EEF6FF]/90'
}

function getDayNumberClass(isToday: boolean, isWeekend: boolean): string {
  if (isToday) return 'bg-[#218EE7] text-white'
  if (isWeekend) return 'text-[#0B477F]'
  return 'text-[#113C69] dark:text-slate-100'
}

function getUniqueEventDotColors(events: PlanningEvent[]): string[] {
  const seen = new Set<string>()
  const colors: string[] = []

  for (const event of events) {
    const color = getPlanningEventColor(event)
    if (seen.has(color)) continue
    seen.add(color)
    colors.push(color)
    if (colors.length >= 4) break
  }

  return colors
}

type YearMonthEventRowProps = {
  event: PlanningEvent
  onClick: (event: PlanningEvent) => void
}

function YearMonthEventRow({ event, onClick }: YearMonthEventRowProps) {
  const dotClass = getPlanningEventColor(event)

  return (
    <button
      type="button"
      onClick={(mouseEvent) => {
        mouseEvent.stopPropagation()
        onClick(event)
      }}
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-[background-color,border-color,box-shadow] hover:bg-[#F6FAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
    >
      <span className={`size-2.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
        {event.vehicleRegistration}{' '}
        <span className="font-medium text-slate-500">{event.label}</span>
        <span className="text-slate-400"> · </span>
        {formatEventShortDate(event.startDate)}
      </span>
    </button>
  )
}

type FleetPlanningCalendarProps = {
  vehicles: Vehicle[]
  initialView?: CalendarView
  onOpenPlanningEvent: (vehicle: Vehicle, event: PlanningEvent) => void
  onOpenDayStatus: (
    vehicle: Vehicle,
    record: ReturnType<typeof getAvailabilityRecordForDate>,
    date: string,
  ) => void
}

export function FleetPlanningCalendar({
  vehicles,
  initialView,
  onOpenPlanningEvent,
  onOpenDayStatus,
}: FleetPlanningCalendarProps) {
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const todayKey = useMemo(() => toDateKey(today), [today])
  const monthGridRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<CalendarView>(initialView ?? 'Week')
  const [focusDate, setFocusDate] = useState(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [planningVehicles, setPlanningVehicles] = useState<Vehicle[]>(vehicles)

  const focusYear = focusDate.getFullYear()
  const focusMonth = focusDate.getMonth()

  useEffect(() => {
    setPlanningVehicles(vehicles)
  }, [vehicles])

  useEffect(() => {
    if (initialView) {
      setView(initialView)
    }
  }, [initialView])

  useEffect(() => {
    if (view !== 'Month' && view !== 'Year') return

    let isCancelled = false

    async function loadPlanningData() {
      const records = await vehiclesService.fetchPlanningAvailabilityRecords(focusYear)
      if (isCancelled) return

      setPlanningVehicles(
        vehicles.map((vehicle) => ({
          ...vehicle,
          availabilityRecords: records.filter(
            (record) => record.vehicleId === vehicle.id,
          ),
        })),
      )
    }

    void loadPlanningData()

    return () => {
      isCancelled = true
    }
  }, [vehicles, focusYear, view])

  const planningEvents = useMemo(
    () => buildFleetPlanningEvents(planningVehicles),
    [planningVehicles],
  )

  const vehicleMap = useMemo(() => {
    return new Map(planningVehicles.map((vehicle) => [vehicle.id, vehicle]))
  }, [planningVehicles])

  const weekDates = useMemo(() => getWeekDates(focusDate), [focusDate])

  const monthGridRange = useMemo(
    () => getMonthGridRange(focusDate),
    [focusDate],
  )

  const monthGridDays = useMemo<FleetCalendarDay[]>(() => {
    const items: FleetCalendarDay[] = []
    let current = monthGridRange.start

    while (current <= monthGridRange.end) {
      const date = new Date(`${current}T00:00:00`)
      const dayEvents = getEventsForDate(planningEvents, current)

      items.push({
        date,
        iso: current,
        label: String(date.getDate()),
        isToday: current === todayKey,
        isWeekend: isWeekendDate(date),
        isCurrentMonth: date.getMonth() === focusMonth,
        events: dayEvents,
      })

      current = addDaysIso(current, 1)
    }

    return items
  }, [focusMonth, monthGridRange.end, monthGridRange.start, planningEvents, todayKey])

  const weekGridDays = useMemo<FleetCalendarDay[]>(() => {
    const range = getWeekRange(focusDate)
    const items: FleetCalendarDay[] = []
    let current = range.start

    while (current <= range.end) {
      const date = new Date(`${current}T00:00:00`)
      items.push({
        date,
        iso: current,
        label: String(date.getDate()),
        isToday: current === todayKey,
        isWeekend: isWeekendDate(date),
        isCurrentMonth: true,
        events: getEventsForDate(planningEvents, current),
      })
      current = addDaysIso(current, 1)
    }

    return items
  }, [focusDate, planningEvents, todayKey])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    return getEventsForDate(planningEvents, selectedDay)
  }, [planningEvents, selectedDay])

  const selectedDayDate = useMemo(() => {
    if (!selectedDay) return null
    return new Date(`${selectedDay}T00:00:00`)
  }, [selectedDay])

  function shiftFocus(amount: number, unit: 'day' | 'week' | 'month' | 'year') {
    setFocusDate((currentDate) => {
      const nextDate = new Date(currentDate)
      if (unit === 'day') nextDate.setDate(nextDate.getDate() + amount)
      if (unit === 'week') nextDate.setDate(nextDate.getDate() + amount * 7)
      if (unit === 'month') nextDate.setMonth(nextDate.getMonth() + amount)
      if (unit === 'year') nextDate.setFullYear(nextDate.getFullYear() + amount)
      return nextDate
    })
    setSelectedDay(null)
  }

  function goToToday() {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    setFocusDate(date)
    setSelectedDay(null)
  }

  function jumpToMonth(month: number, year = focusYear) {
    const nextDate = new Date(year, month, 1)
    nextDate.setHours(0, 0, 0, 0)
    setFocusDate(nextDate)
    setSelectedDay(null)
  }

  function jumpToYear(year: number) {
    if (!Number.isFinite(year) || year < 1900 || year > 2200) return
    jumpToMonth(focusMonth, year)
  }

  function jumpToDate(iso: string) {
    if (!iso) return
    const date = new Date(`${iso}T00:00:00`)
    date.setHours(0, 0, 0, 0)
    setFocusDate(date)
    setSelectedDay(null)
  }

  function openMonth(year: number, month: number) {
    jumpToMonth(month, year)
    setView('Month')

    window.setTimeout(() => {
      monthGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function handlePlanningEventClick(event: PlanningEvent) {
    const vehicle = vehicleMap.get(event.vehicleId)
    if (!vehicle) return
    onOpenPlanningEvent(vehicle, event)
  }

  function handleViewChange(nextView: CalendarView) {
    setView(nextView)
    setSelectedDay(null)
  }

  function selectDay(dateKey: string) {
    setSelectedDay(dateKey)
  }

  const periodLabel =
    view === 'Year'
      ? `${focusYear}`
      : view === 'Month'
        ? formatMonthYear(focusYear, focusMonth)
        : view === 'Week'
          ? `${formatDayLabel(weekDates[0])} – ${formatDayLabel(weekDates[6])}`
          : formatWeekHeader(focusDate)

  const planningLegend = [
    'Available',
    'Assigned',
    'Workshop',
    'Maintenance',
    'Out of Service',
    'Off Road',
    'Reserved',
    'Service',
    'MOT',
    'Insurance',
    'Road Tax',
    'Tachograph Calibration',
  ]

  function getLegendDotClass(label: string): string {
    return planningEventColorMap[label] ?? 'bg-slate-500'
  }

  function renderCompactMonthCell(day: FleetCalendarDay) {
    const eventCount = day.events.length
    const dotColors = getUniqueEventDotColors(day.events)
    const isSelectedDay = selectedDay === day.iso
    const shortStatus =
      eventCount === 1 ? day.events[0]?.label : null

    return (
      <button
        key={day.iso}
        type="button"
        onClick={() => selectDay(day.iso)}
        className={`relative box-border flex h-[112px] min-h-[112px] flex-col overflow-hidden rounded-[16px] border p-2 text-left transition-[border-color,box-shadow,filter] sm:h-[132px] sm:min-h-[132px] ${
          day.isCurrentMonth ? 'opacity-100' : 'opacity-55'
        } ${getMonthCellBackgroundClass(eventCount > 0, day.isWeekend)} ${
          day.isToday ? 'border-[#218EE7] ring-2 ring-inset ring-[#BFE3F5]' : ''
        } ${
          isSelectedDay
            ? 'z-10 border-[#218EE7] ring-2 ring-inset ring-[#89CFF0]'
            : 'z-0 hover:border-[#89CFF0] hover:ring-2 hover:ring-inset hover:ring-[#BFE3F5]/80 hover:brightness-[1.02]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getDayNumberClass(
              day.isToday,
              day.isWeekend,
            )}`}
          >
            {day.label}
          </span>
          {eventCount > 0 ? (
            <span className="shrink-0 rounded-full bg-[#D3E9FC] px-2 py-0.5 text-[10px] font-bold text-[#0B68BE]">
              {eventCount} event{eventCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        {eventCount > 0 ? (
          <div className="mt-auto flex flex-col gap-1.5 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {dotColors.map((colorClass) => (
                <span
                  key={colorClass}
                  className={`size-2.5 rounded-full ring-2 ring-white/80 ${colorClass}`}
                />
              ))}
            </div>
            {shortStatus && eventCount === 1 ? (
              <span className="truncate text-[10px] font-semibold text-[#0B68BE]">
                {shortStatus}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>
    )
  }

  function renderWeekDayHeader(day: FleetCalendarDay) {
    const isSelectedDay = selectedDay === day.iso

    return (
      <button
        key={day.iso}
        type="button"
        onClick={() => selectDay(day.iso)}
        className={`rounded-[12px] px-2 py-2.5 text-center text-xs font-bold uppercase tracking-[0.06em] transition-[border-color,box-shadow,filter] ${
          isSelectedDay
            ? 'border border-[#218EE7] bg-[#EEF6FF] text-[#0B68BE] ring-2 ring-inset ring-[#89CFF0]'
            : day.isWeekend
              ? 'border border-[#9CBEE0]/90 bg-gradient-to-b from-[#C5D9E8]/95 to-[#B3CBE0]/90 text-[#0B477F] hover:brightness-[1.02]'
              : 'border border-[#D3E9FC]/70 bg-[#E8F5FF]/80 text-[#0B68BE] hover:border-[#89CFF0] hover:ring-2 hover:ring-inset hover:ring-[#BFE3F5]/80'
        } ${day.isToday ? 'ring-2 ring-inset ring-[#BFE3F5]' : ''}`}
      >
        {formatWeekHeader(day.date)}
        {day.events.length > 0 ? (
          <span className="mt-1 block text-[10px] font-semibold normal-case tracking-normal text-[#5499BF]">
            {day.events.length} event{day.events.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </button>
    )
  }

  const gridDays = view === 'Month' ? monthGridDays : view === 'Week' ? weekGridDays : []

  return (
    <div className={`${vehiclePanelClass} overflow-hidden`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-[14px] bg-[#D3E9FC] text-[#0B68BE]">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-[#113C69] dark:text-slate-100">
                  Fleet Availability Calendar
                </p>
                <p className="mt-0.5 text-sm font-medium text-[#5499BF] dark:text-slate-400">
                  Plan availability, maintenance, and document renewals across the year.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-1.5 rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] p-1 shadow-sm ring-1 ring-[#C5DFFB]/40 dark:border-white/10 dark:bg-slate-900/70 dark:ring-white/10">
              {(['Day', 'Week', 'Month', 'Year'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleViewChange(item)}
                  className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                    view === item
                      ? 'bg-[#218EE7] text-white shadow-[0_4px_12px_rgba(33,142,231,0.2)]'
                      : 'text-[#5499BF] hover:bg-[#EEF6FF] hover:text-[#0B68BE] dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {view === 'Month' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="fleet-calendar-month">
                    Select month
                  </label>
                  <select
                    id="fleet-calendar-month"
                    value={focusMonth}
                    onChange={(event) => jumpToMonth(Number(event.target.value))}
                    className={`${vehicleSelectClass} h-9 min-w-32`}
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="fleet-calendar-year">
                    Select year
                  </label>
                  <input
                    id="fleet-calendar-year"
                    type="number"
                    min={1900}
                    max={2200}
                    value={focusYear}
                    onChange={(event) => jumpToYear(Number.parseInt(event.target.value, 10))}
                    className={`${calendarInputClass} w-24`}
                    aria-label="Select year"
                  />
                </div>
              ) : view === 'Week' || view === 'Day' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="fleet-calendar-date"
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#5499BF] dark:text-slate-400"
                  >
                    {view === 'Week' ? 'Week of' : 'Date'}
                  </label>
                  <input
                    id="fleet-calendar-date"
                    type="date"
                    value={toDateKey(focusDate)}
                    onChange={(event) => jumpToDate(event.target.value)}
                    className={`${calendarInputClass} w-full min-w-0 sm:min-w-40 sm:w-auto`}
                  />
                </div>
              ) : (
                <input
                  type="number"
                  min={1900}
                  max={2200}
                  value={focusYear}
                  onChange={(event) => {
                    const year = Number.parseInt(event.target.value, 10)
                    if (!Number.isFinite(year)) return
                    setFocusDate(new Date(year, 0, 1))
                    setSelectedDay(null)
                  }}
                  className={`${calendarInputClass} w-24`}
                  aria-label="Select year"
                />
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  shiftFocus(
                    -1,
                    view === 'Year'
                      ? 'year'
                      : view === 'Month'
                        ? 'month'
                        : view === 'Week'
                          ? 'week'
                          : 'day',
                  )
                }
                className="h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-2 text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
                aria-label="Previous period"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-3 text-sm font-semibold text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  shiftFocus(
                    1,
                    view === 'Year'
                      ? 'year'
                      : view === 'Month'
                        ? 'month'
                        : view === 'Week'
                          ? 'week'
                          : 'day',
                  )
                }
                className="h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-2 text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
                aria-label="Next period"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {planningLegend.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#5499BF] ring-1 ring-[#D3E9FC] dark:bg-slate-900/70 dark:text-slate-400 dark:ring-white/10"
            >
              <span className={`size-2 shrink-0 rounded-full ${getLegendDotClass(label)}`} />
              {label}
            </span>
          ))}
        </div>

        {view !== 'Year' ? (
          <p className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[#113C69] dark:text-slate-100">
            {periodLabel}
            {view === 'Month' ? (
              <span className="ml-2 text-sm font-medium text-[#5499BF] dark:text-slate-400">
                · {getEventsForMonth(planningEvents, focusYear, focusMonth).length} events
              </span>
            ) : null}
          </p>
        ) : null}

        {view === 'Year' ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 12 }, (_, month) => {
              const monthEvents = getEventsForMonth(planningEvents, focusYear, month)
              const previewEvents = monthEvents.slice(0, 4)

              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => openMonth(focusYear, month)}
                  className="cursor-pointer rounded-[16px] border border-[#D3E9FC] bg-[#F8FBFF] p-3.5 text-left shadow-sm ring-1 ring-[#C5DFFB]/30 transition-[border-color,box-shadow,filter] hover:border-[#C5DFFB] hover:shadow-[0_8px_20px_rgba(33,142,231,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89CFF0] dark:border-white/10 dark:bg-slate-900/70 dark:ring-white/10 dark:hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-3 px-1">
                    <p className="text-xl font-semibold tracking-[-0.02em] text-[#113C69] dark:text-slate-100">
                      {formatMonthLabel(month)}
                    </p>
                    <span className="shrink-0 rounded-full bg-[#EEF6FF] px-2.5 py-1 text-xs font-semibold text-[#0B68BE] ring-1 ring-[#C5DFFB]">
                      {monthEvents.length} events
                    </span>
                  </div>

                  <div className="mt-2.5 rounded-[12px] border border-[#D3E9FC]/80 bg-white/80 p-2 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                    {monthEvents.length === 0 ? (
                      <p className="px-2 py-3 text-sm font-medium text-[#5499BF] dark:text-slate-400">
                        No events planned
                      </p>
                    ) : (
                      <div className="space-y-0.5">
                        {previewEvents.map((event) => (
                          <YearMonthEventRow
                            key={`${event.id}-${month}`}
                            event={event}
                            onClick={handlePlanningEventClick}
                          />
                        ))}
                        {monthEvents.length > 4 ? (
                          <p className="px-2.5 pt-1 text-xs font-semibold text-[#218EE7]">
                            +{monthEvents.length - 4} more — open full month
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}

        {view === 'Month' ? (
          <div ref={monthGridRef} className="mt-4 scroll-mt-8">
            <div className="overflow-x-auto overflow-y-visible pb-1">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <div
                      key={label}
                      className={getWeekdayHeaderClass(index >= 5)}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2 overflow-visible">
                  {gridDays.map((day) => renderCompactMonthCell(day))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {view === 'Week' ? (
          <div className="mt-4 overflow-x-auto">
            <div
              className="grid min-w-max gap-2"
              style={{
                gridTemplateColumns: '220px repeat(7, minmax(92px, 1fr))',
              }}
            >
              <div className="rounded-[12px] border border-[#D3E9FC]/70 bg-[#E8F5FF]/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#0B68BE]">
                Vehicle
              </div>
              {weekGridDays.map((day) => renderWeekDayHeader(day))}

              {planningVehicles.map((vehicle) => (
                <div key={vehicle.id} className="contents">
                  <div className="rounded-[12px] border border-[#D3E9FC]/80 bg-white px-4 py-3 text-sm font-semibold text-[#113C69] shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100">
                    {vehicle.registration}
                    <p className="mt-1 text-xs font-medium text-[#5499BF] dark:text-slate-400">
                      {getVehicleName(vehicle)}
                    </p>
                  </div>
                  {weekGridDays.map((day) => {
                    const dateKey = day.iso
                    const statusForDate = getVehicleStatusForDate(vehicle, dateKey)
                    const recordForDate = getAvailabilityRecordForDate(vehicle, dateKey)
                    const dayEvents = getEventsForDate(
                      buildFleetPlanningEvents([vehicle]),
                      dateKey,
                    )
                    const isSelectedColumn = selectedDay === dateKey
                    const statusClass = calendarClassMap[statusForDate]

                    return (
                      <button
                        key={`${vehicle.id}-${dateKey}`}
                        type="button"
                        onClick={() => {
                          selectDay(dateKey)
                          onOpenDayStatus(vehicle, recordForDate, dateKey)
                        }}
                        className={`box-border flex h-[72px] min-h-[72px] flex-col justify-between overflow-hidden rounded-[12px] border p-2 text-left text-[11px] font-semibold leading-snug text-white shadow-sm transition-[border-color,box-shadow,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${statusClass} ${
                          isSelectedColumn
                            ? 'ring-2 ring-inset ring-white/70'
                            : 'hover:brightness-[1.05] hover:ring-2 hover:ring-inset hover:ring-white/40'
                        } ${day.isWeekend ? 'opacity-95' : ''}`}
                      >
                        <p className="truncate">
                          {statusForDate === 'Off Road' ? 'OFF ROAD' : statusForDate}
                        </p>
                        {dayEvents.length > 0 ? (
                          <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-bold">
                            {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {view === 'Day' ? (
          <div className="mt-4 overflow-x-auto">
            <div
              className="grid min-w-max gap-2"
              style={{
                gridTemplateColumns: '220px minmax(120px, 1fr)',
              }}
            >
              <div className="rounded-[12px] border border-[#D3E9FC]/70 bg-[#E8F5FF]/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#0B68BE]">
                Vehicle
              </div>
              <button
                type="button"
                onClick={() => selectDay(toDateKey(focusDate))}
                className={`rounded-[12px] px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.06em] transition-[border-color,box-shadow,filter] ${
                  selectedDay === toDateKey(focusDate)
                    ? 'border border-[#218EE7] bg-[#EEF6FF] text-[#0B68BE] ring-2 ring-inset ring-[#89CFF0]'
                    : isWeekendDate(focusDate)
                      ? 'border border-[#9CBEE0]/90 bg-gradient-to-b from-[#C5D9E8]/95 to-[#B3CBE0]/90 text-[#0B477F]'
                      : 'border border-[#D3E9FC]/70 bg-[#E8F5FF]/80 text-[#0B68BE]'
                }`}
              >
                {formatWeekHeader(focusDate)}
              </button>

              {planningVehicles.map((vehicle) => {
                const dateKey = toDateKey(focusDate)
                const statusForDate = getVehicleStatusForDate(vehicle, dateKey)
                const recordForDate = getAvailabilityRecordForDate(vehicle, dateKey)
                const dayEvents = getEventsForDate(
                  buildFleetPlanningEvents([vehicle]),
                  dateKey,
                )
                const statusClass = calendarClassMap[statusForDate]

                return (
                  <div key={vehicle.id} className="contents">
                    <div className="rounded-[12px] border border-[#D3E9FC]/80 bg-white px-4 py-3 text-sm font-semibold text-[#113C69] shadow-sm">
                      {vehicle.registration}
                      <p className="mt-1 text-xs font-medium text-[#5499BF]">
                        {getVehicleName(vehicle)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        selectDay(dateKey)
                        onOpenDayStatus(vehicle, recordForDate, dateKey)
                      }}
                      className={`box-border flex h-[72px] min-h-[72px] flex-col justify-between overflow-hidden rounded-[12px] border p-2.5 text-left text-[11px] font-semibold leading-snug text-white shadow-sm transition-[border-color,box-shadow,filter] hover:brightness-[1.05] hover:ring-2 hover:ring-inset hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${statusClass}`}
                    >
                      <p className="truncate">
                        {statusForDate === 'Off Road' ? 'OFF ROAD' : statusForDate}
                      </p>
                      {dayEvents.length > 0 ? (
                        <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-bold">
                          {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {selectedDay && selectedDayDate ? (
          <FleetCalendarDayDetailsPanel
            dateKey={selectedDay}
            date={selectedDayDate}
            events={selectedDayEvents}
            vehicleMap={vehicleMap}
            onDismiss={() => setSelectedDay(null)}
            onOpenEvent={handlePlanningEventClick}
          />
        ) : null}
      </div>
    </div>
  )
}

export { isPlanningEventEditable }
