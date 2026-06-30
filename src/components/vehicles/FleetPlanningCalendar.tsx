import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { calendarClassMap } from '@/components/vehicles/VehicleStatusBadge'
import {
  formatShortDate,
  getAvailabilityRecordForDate,
  getFirstNotesLine,
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
  getMonthDates,
  getPlanningEventColor,
  getWeekDates,
  isPlanningEventEditable,
  toDateKey,
} from '@/lib/vehiclePlanning'
import {
  getVehicleStatusForDate,
  vehiclesService,
  type Vehicle,
} from '@/services/vehiclesService'

function getVehicleName(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`.trim()
}

function formatCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

const weekdayLabels = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

function getPlanningEventIcon(label: string): string {
  const icons: Record<string, string> = {
    Service: '🔧',
    Workshop: '🚧',
    Maintenance: '🛠',
    'Off Road': '🚫',
    'Out of Service': '⛔',
    MOT: '📄',
    Insurance: '🛡',
    'Road Tax': '💷',
    'Tachograph Calibration': '💳',
    Assigned: '🚛',
    Available: '🟢',
    Reserved: '🟣',
  }

  return icons[label] ?? '📅'
}

function isWeekendDate(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
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
      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-[250ms] hover:bg-[#F6FAFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
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

type PlanningEventChipProps = {
  event: PlanningEvent
  onClick: (event: PlanningEvent, vehicle: Vehicle) => void
  vehicle: Vehicle
  compact?: boolean
}

function PlanningEventChip({
  event,
  onClick,
  vehicle,
  compact = false,
}: PlanningEventChipProps) {
  const colorClass = getPlanningEventColor(event)
  const tooltip = [
    `Vehicle: ${event.vehicleRegistration}`,
    `Event: ${event.label}`,
    `Reason: ${event.reason ?? 'Not set'}`,
    `Start: ${formatShortDate(event.startDate)}`,
    `End: ${event.endDate ? formatShortDate(event.endDate) : 'Not set'}`,
    `Notes: ${getFirstNotesLine(event.notes)}`,
  ].join('\n')

  return (
    <button
      type="button"
      title={tooltip}
      onClick={(mouseEvent) => {
        mouseEvent.stopPropagation()
        onClick(event, vehicle)
      }}
      className={`w-full rounded-[14px] ${colorClass} text-left font-semibold text-white shadow-sm transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
        compact ? 'px-3 py-2.5 text-xs' : 'rounded-xl px-2 py-1.5 text-[11px]'
      }`}
    >
      <p className={`flex items-center gap-1.5 truncate ${compact ? 'text-xs' : ''}`}>
        {compact ? (
          <span className="shrink-0 text-sm leading-none">{getPlanningEventIcon(event.label)}</span>
        ) : null}
        <span className="truncate">{event.vehicleRegistration}</span>
      </p>
      <p className={`truncate opacity-95 ${compact ? 'mt-1 text-[11px]' : 'opacity-90'}`}>
        {event.label}
      </p>
      {!compact ? (
        <>
          <p className="mt-0.5 truncate opacity-90">{formatShortDate(event.startDate)}</p>
          {event.endDate ? (
            <p className="truncate opacity-90">→ {formatShortDate(event.endDate)}</p>
          ) : null}
          {event.reason ? (
            <p className="mt-0.5 truncate opacity-90">{event.reason}</p>
          ) : null}
        </>
      ) : null}
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
  const today = useMemo(() => new Date(), [])
  const monthGridRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<CalendarView>(initialView ?? 'Week')
  const [focusDate, setFocusDate] = useState(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  })
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

  function shiftFocus(amount: number, unit: 'day' | 'week' | 'month' | 'year') {
    setFocusDate((currentDate) => {
      const nextDate = new Date(currentDate)
      if (unit === 'day') nextDate.setDate(nextDate.getDate() + amount)
      if (unit === 'week') nextDate.setDate(nextDate.getDate() + amount * 7)
      if (unit === 'month') nextDate.setMonth(nextDate.getMonth() + amount)
      if (unit === 'year') nextDate.setFullYear(nextDate.getFullYear() + amount)
      return nextDate
    })
  }

  function openMonth(year: number, month: number) {
    const nextDate = new Date(year, month, 1)
    nextDate.setHours(0, 0, 0, 0)
    setFocusDate(nextDate)
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

  const weekDates = useMemo(() => getWeekDates(focusDate), [focusDate])
  const monthDates = useMemo(
    () => getMonthDates(focusYear, focusMonth),
    [focusYear, focusMonth],
  )

  const headerLabel =
    view === 'Year'
      ? `${focusYear}`
      : view === 'Month'
        ? formatMonthYear(focusYear, focusMonth)
        : view === 'Week'
          ? `${formatDayLabel(weekDates[0])} – ${formatDayLabel(weekDates[6])}`
          : formatCalendarDate(focusDate)

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
    if (label === 'Available') return 'bg-emerald-500'
    if (label === 'Assigned' || label === 'Insurance') return 'bg-blue-500'
    if (label === 'Workshop') return 'bg-yellow-400'
    if (label === 'Maintenance' || label === 'Service') return 'bg-orange-500'
    if (label === 'Out of Service') return 'bg-red-600'
    if (label === 'Off Road') return 'bg-slate-950'
    if (label === 'Reserved' || label === 'Tachograph Calibration') return 'bg-purple-500'
    if (label === 'MOT') return 'bg-amber-500'
    return 'bg-slate-500'
  }

  return (
    <Card className="overflow-hidden rounded-[18px] border border-[rgba(75,120,220,0.10)] bg-[#EAF2FF]/70 py-0 shadow-[0_8px_24px_rgba(40,80,140,0.05)] ring-0">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-[-0.03em] text-[#2A376F]">
              Fleet Availability Calendar
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-500">
              Plan availability, maintenance, and document renewals across the year.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {view !== 'Year' ? (
              <div className="flex items-center gap-2 rounded-[18px] border border-[rgba(70,110,220,0.08)] bg-[#F7FAFF] px-2 py-1 shadow-[0_4px_12px_rgba(40,80,140,0.04)]">
                <button
                  type="button"
                  onClick={() =>
                    shiftFocus(
                      -1,
                      view === 'Month'
                        ? 'month'
                        : view === 'Week'
                          ? 'week'
                          : 'day',
                    )
                  }
                  className="rounded-[12px] p-2 text-slate-500 transition-all duration-200 hover:bg-[#EEF4FF] hover:text-[#2563EB]"
                  aria-label={
                    view === 'Month' ? 'Previous month' : 'Previous period'
                  }
                >
                  <ChevronLeft className="size-4" />
                </button>
                <p
                  className={`min-w-[140px] text-center font-semibold text-slate-800 ${
                    view === 'Month' ? 'text-lg' : 'text-sm'
                  }`}
                >
                  {headerLabel}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    shiftFocus(
                      1,
                      view === 'Month'
                        ? 'month'
                        : view === 'Week'
                          ? 'week'
                          : 'day',
                    )
                  }
                  className="rounded-[12px] p-2 text-slate-500 transition-all duration-200 hover:bg-[#EEF4FF] hover:text-[#2563EB]"
                  aria-label={view === 'Month' ? 'Next month' : 'Next period'}
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[18px] border border-[rgba(70,110,220,0.08)] bg-[#F7FAFF] px-4 py-2 shadow-[0_4px_12px_rgba(40,80,140,0.04)]">
                <button
                  type="button"
                  onClick={() => shiftFocus(-1, 'year')}
                  className="rounded-[12px] p-2 text-slate-500 transition-all duration-200 hover:bg-[#EEF4FF] hover:text-[#2563EB]"
                  aria-label="Previous year"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <p className="min-w-[100px] text-center text-lg font-semibold text-slate-800">
                  {focusYear}
                </p>
                <button
                  type="button"
                  onClick={() => shiftFocus(1, 'year')}
                  className="rounded-[12px] p-2 text-slate-500 transition-all duration-200 hover:bg-[#EEF4FF] hover:text-[#2563EB]"
                  aria-label="Next year"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}

            <div className="flex gap-2 rounded-[18px] border border-[rgba(70,110,220,0.08)] bg-[#F7FAFF] p-1 shadow-[0_4px_12px_rgba(40,80,140,0.04)]">
              {(['Day', 'Week', 'Month', 'Year'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={`rounded-[14px] px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    view === item
                      ? 'bg-[#EEF4FF] text-[#2563EB] shadow-[0_4px_12px_rgba(40,80,140,0.06)]'
                      : 'text-slate-500 hover:text-[#2A376F]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
          {planningLegend.map((label) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${getLegendDotClass(label)}`} />
              {label}
            </span>
          ))}
        </div>

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
                  className="cursor-pointer rounded-[18px] border border-[rgba(70,110,220,0.08)] bg-[#EEF4FF] p-3.5 text-left shadow-[0_4px_12px_rgba(40,80,140,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#EAF2FF] hover:shadow-[0_8px_20px_rgba(40,80,140,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                >
                  <div className="flex items-start justify-between gap-3 px-1">
                    <p className="text-xl font-semibold tracking-[-0.02em] text-slate-950">
                      {formatMonthLabel(month)}
                    </p>
                    <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#2563EB] ring-1 ring-blue-100">
                      {monthEvents.length} events
                    </span>
                  </div>

                  <div className="mt-2.5 rounded-[14px] border border-[rgba(70,110,220,0.08)] bg-[#F7FAFF] p-2 shadow-[0_4px_12px_rgba(40,80,140,0.04)]">
                    {monthEvents.length === 0 ? (
                      <p className="px-2 py-3 text-sm font-medium text-slate-400">
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
                          <p className="px-2.5 pt-1 text-xs font-semibold text-[#2563EB]">
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
          <div ref={monthGridRef} className="mt-8 scroll-mt-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  {formatMonthYear(focusYear, focusMonth)}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  {getEventsForMonth(planningEvents, focusYear, focusMonth).length} scheduled
                  events this month
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => shiftFocus(-1, 'month')}
                  className="h-10 rounded-[14px] border-0 bg-white px-4 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] hover:bg-[#EAF4FF] hover:text-[#2563EB]"
                >
                  <ChevronLeft className="size-4" />
                  Previous Month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView('Year')}
                  className="h-10 rounded-[14px] border-0 bg-[#EAF4FF] px-4 font-semibold text-[#2563EB] shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] hover:bg-[#DCEEFF]"
                >
                  Back to Year View
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => shiftFocus(1, 'month')}
                  className="h-10 rounded-[14px] border-0 bg-white px-4 font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition-all duration-[250ms] hover:bg-[#EAF4FF] hover:text-[#2563EB]"
                >
                  Next Month
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[820px] grid-cols-7 gap-3">
                {weekdayLabels.map((label) => (
                  <div
                    key={label}
                    className="rounded-full bg-[#EAF4FF] px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#2563EB] ring-1 ring-blue-100"
                  >
                    {label}
                  </div>
                ))}

                {Array.from({
                  length: (monthDates[0].getDay() + 6) % 7,
                }).map((_, index) => (
                  <div key={`pad-${index}`} className="min-h-[148px]" aria-hidden />
                ))}

                {monthDates.map((date) => {
                  const dateKey = toDateKey(date)
                  const dayEvents = getEventsForDate(planningEvents, dateKey)
                  const isToday = toDateKey(today) === dateKey
                  const isWeekend = isWeekendDate(date)

                  return (
                    <div
                      key={dateKey}
                      className={`group flex min-h-[148px] cursor-pointer flex-col rounded-[16px] border border-blue-100/90 p-2.5 shadow-[0_4px_14px_rgba(59,130,246,0.07)] transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(59,130,246,0.14)] ${
                        isToday
                          ? 'bg-[#F5F9FF] ring-2 ring-[#3B82F6] shadow-[0_0_0_4px_rgba(59,130,246,0.14),0_8px_20px_rgba(59,130,246,0.12)]'
                          : isWeekend
                            ? 'bg-[#EEF4FC]'
                            : 'bg-[#F5F9FF]'
                      }`}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2563EB] shadow-sm ring-1 ring-blue-100">
                        {date.getDate()}
                      </div>

                      {dayEvents.length > 0 ? (
                        <div className="mt-3 flex flex-1 flex-col gap-2 rounded-[14px] bg-white p-2 ring-1 ring-blue-50/80">
                          {dayEvents.map((event) => {
                            const vehicle = vehicleMap.get(event.vehicleId)
                            if (!vehicle) return null

                            return (
                              <PlanningEventChip
                                key={`${event.id}-${dateKey}`}
                                event={event}
                                vehicle={vehicle}
                                onClick={handlePlanningEventClick}
                                compact
                              />
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}

        {view === 'Day' || view === 'Week' ? (
          <div className="mt-5 overflow-x-auto">
            <div
              className="grid min-w-max gap-2"
              style={{
                gridTemplateColumns: `220px repeat(${
                  view === 'Day' ? 1 : 7
                }, minmax(92px, 1fr))`,
              }}
            >
              <div className="rounded-2xl bg-[#F6FAFF] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Vehicle
              </div>
              {(view === 'Day' ? [focusDate] : weekDates).map((date) => (
                <div
                  key={date.toISOString()}
                  className="rounded-2xl bg-[#F6FAFF] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {formatCalendarDate(date)}
                </div>
              ))}

              {planningVehicles.map((vehicle) => (
                <div key={vehicle.id} className="contents">
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 ring-1 ring-blue-50">
                    {vehicle.registration}
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {getVehicleName(vehicle)}
                    </p>
                  </div>
                  {(view === 'Day' ? [focusDate] : weekDates).map((date) => {
                    const dateKey = toDateKey(date)
                    const statusForDate = getVehicleStatusForDate(vehicle, dateKey)
                    const recordForDate = getAvailabilityRecordForDate(vehicle, dateKey)
                    const dayEvents = getEventsForDate(
                      buildFleetPlanningEvents([vehicle]),
                      dateKey,
                    )
                    const tooltip = [
                      `Vehicle: ${getVehicleName(vehicle)}`,
                      `Status: ${statusForDate}`,
                      `Reason: ${recordForDate?.reason ?? 'Not set'}`,
                      `Start: ${recordForDate ? formatShortDate(recordForDate.startDate) : formatShortDate(dateKey)}`,
                      `End: ${recordForDate?.endDate ? formatShortDate(recordForDate.endDate) : 'Not set'}`,
                      `Expected Return: ${recordForDate?.endDate ? formatShortDate(recordForDate.endDate) : 'Not set'}`,
                      `Notes: ${getFirstNotesLine(recordForDate?.notes ?? vehicle.notes)}`,
                    ].join('\n')

                    return (
                      <button
                        key={`${vehicle.id}-${date.toISOString()}`}
                        type="button"
                        title={tooltip}
                        onClick={() =>
                          onOpenDayStatus(vehicle, recordForDate, dateKey)
                        }
                        className={`min-h-16 rounded-2xl ${calendarClassMap[statusForDate]} p-3 text-left text-xs font-semibold text-white shadow-sm transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}
                      >
                        <p>{statusForDate === 'Off Road' ? 'OFF ROAD' : statusForDate}</p>
                        {dayEvents.length > 0 ? (
                          <p className="mt-1 text-[10px] font-medium opacity-90">
                            {dayEvents.length} event{dayEvents.length === 1 ? '' : 's'}
                          </p>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { isPlanningEventEditable }
