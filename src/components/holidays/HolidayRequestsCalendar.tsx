import { Button } from '@/components/ui/button'
import { holidayPageCardClass, holidaySelectClass } from '@/components/holidays/holidayUiStyles'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  DEFAULT_HOLIDAY_WORKING_DAYS,
  type HolidayWorkingDay,
} from '@/lib/companySettingsTypes'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
import {
  buildHolidayRequestsByDay,
  getStatusLabel,
  HOLIDAY_MAX_WORKERS_OFF_PER_DAY,
  resolveWorkerDisplayName,
} from '@/lib/holidayRequestUtils'
import type { Driver } from '@/services/driversService'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export type HolidayCalendarView = 'month' | 'week'

type HolidayCalendarRange = {
  start: string
  end: string
}

type HolidayRequestsCalendarProps = {
  requests: HolidayRequest[]
  workers?: Driver[]
  isLoading?: boolean
  error?: string | null
  view: HolidayCalendarView
  anchorDate: string
  onViewChange: (view: HolidayCalendarView) => void
  onAnchorDateChange: (date: string) => void
  onRangeChange: (range: HolidayCalendarRange) => void
}

type CalendarDay = {
  date: Date
  iso: string
  label: string
  isToday: boolean
  isNonWorkingDay: boolean
  isCurrentMonth: boolean
  requests: HolidayRequest[]
}

const DAY_INDEX_TO_HOLIDAY_DAY: HolidayWorkingDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const WEEKDAY_HEADER_KEYS: HolidayWorkingDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const WEEK_RANGE_FULL_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, month) => ({
  value: month,
  label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, month, 1)),
}))
const calendarInputClass =
  'h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-3 text-sm font-semibold text-[#113C69] shadow-sm outline-none transition-colors hover:border-[#BFE3F5] focus:border-[#89CFF0] focus:ring-3 focus:ring-[#BFE3F5]/70 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-500/30'

function parseIsoDate(value: string): Date {
  return new Date(`${normalizeIsoDate(value)}T00:00:00`)
}

function normalizeIsoDate(value: string): string {
  return value.slice(0, 10)
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

function addDaysLocal(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dedupeRequestsByWorker(requests: HolidayRequest[]): HolidayRequest[] {
  const seen = new Set<string>()
  const unique: HolidayRequest[] = []

  for (const request of requests) {
    if (seen.has(request.workerId)) continue
    seen.add(request.workerId)
    unique.push(request)
  }

  return unique
}

function resolveCalendarWorkerName(
  request: HolidayRequest,
  workersById: Map<string, Driver>,
): string {
  const joinedName = request.workerName?.trim()
  if (joinedName && joinedName !== 'Unknown worker' && joinedName !== 'Worker') {
    return joinedName
  }

  const worker = workersById.get(request.workerId)
  if (worker) {
    return resolveWorkerDisplayName(worker.firstName, worker.lastName)
  }

  return joinedName || 'Worker'
}

function getDayCellToneClass(requests: HolidayRequest[]): string {
  if (requests.length === 0) return ''

  const hasApproved = requests.some((request) => request.status === 'Approved')
  const hasPending = requests.some((request) => request.status === 'Pending')

  if (hasApproved && hasPending) {
    return 'border-teal-200/90 bg-gradient-to-br from-teal-50/95 to-amber-50/90'
  }
  if (hasApproved) {
    return 'border-teal-200/90 bg-teal-50/95'
  }
  if (hasPending) {
    return 'border-amber-200/90 bg-amber-50/95'
  }

  return ''
}

function isNonWorkingDayDate(date: Date, workingDays: HolidayWorkingDay[]): boolean {
  const day = DAY_INDEX_TO_HOLIDAY_DAY[date.getDay()]
  return !workingDays.includes(day)
}

function getWeekdayHeaderClass(isNonWorkingDay: boolean): string {
  if (isNonWorkingDay) {
    return 'rounded-[12px] border border-[#9CBEE0]/90 bg-gradient-to-b from-[#C5D9E8]/95 to-[#B3CBE0]/90 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#0B477F] shadow-sm'
  }

  return 'rounded-[12px] border border-[#D3E9FC]/70 bg-[#E8F5FF]/80 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#0B68BE]'
}

function getDayCellBackgroundClass(
  requests: HolidayRequest[],
  isNonWorkingDay: boolean,
): string {
  if (requests.length === 0) {
    if (isNonWorkingDay) {
      return 'border-[#9CBEE0] bg-gradient-to-br from-[#D4E4F0]/98 to-[#B8CFE0]/92 hover:from-[#CCDBEC] hover:to-[#AEC6DC]'
    }
    return 'border-[#D3E9FC] bg-white/95 hover:bg-[#FAFCFF] dark:border-white/10 dark:bg-slate-900/70 dark:hover:bg-slate-800/50'
  }

  const hasApproved = requests.some((request) => request.status === 'Approved')
  const hasPending = requests.some((request) => request.status === 'Pending')

  if (isNonWorkingDay) {
    if (hasApproved && hasPending) {
      return 'border-[#9CBEE0] bg-gradient-to-br from-teal-50/92 via-amber-50/84 to-[#B8CFE0]/88 hover:brightness-[0.99]'
    }
    if (hasApproved) {
      return 'border-[#7FB8A8] bg-gradient-to-br from-teal-50/94 to-[#B8CFE0]/86 hover:brightness-[0.99]'
    }
    if (hasPending) {
      return 'border-[#D4B48A] bg-gradient-to-br from-amber-50/94 to-[#B8CFE0]/86 hover:brightness-[0.99]'
    }
  }

  return `${getDayCellToneClass(requests)} hover:brightness-[0.99]`
}

function getDayNumberClass(isToday: boolean, isNonWorkingDay: boolean): string {
  if (isToday) return 'bg-[#218EE7] text-white'
  if (isNonWorkingDay) return 'text-[#0B477F]'
  return 'text-[#113C69] dark:text-slate-100'
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function getMonday(date: Date): Date {
  const dayOffset = (date.getDay() + 6) % 7
  return addDaysLocal(date, -dayOffset)
}

function getMonthGridRange(date: Date): HolidayCalendarRange {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: toIsoDate(getMonday(monthStart)),
    end: toIsoDate(addDaysLocal(getMonday(monthEnd), 6)),
  }
}

function getWeekRange(date: Date): HolidayCalendarRange {
  const start = getMonday(date)
  return {
    start: toIsoDate(start),
    end: toIsoDate(addDaysLocal(start, 6)),
  }
}

function formatDateRange(request: HolidayRequest): string {
  const startIso = normalizeIsoDate(request.startDate)
  const endIso = normalizeIsoDate(request.endDate)
  const start = WEEK_RANGE_FORMATTER.format(parseIsoDate(startIso))
  const end = WEEK_RANGE_FORMATTER.format(parseIsoDate(endIso))
  return startIso === endIso ? start : `${start} - ${end}`
}

function formatWeekRange(start: string, end: string): string {
  return `${WEEK_RANGE_FULL_FORMATTER.format(parseIsoDate(start))} - ${WEEK_RANGE_FULL_FORMATTER.format(
    parseIsoDate(end),
  )}`
}

function getLeaveTypeLabel(request: HolidayRequest): string {
  if (request.leaveType === 'unpaid_leave') return 'Unpaid leave'
  if (request.leaveType === 'bank_holiday') return 'Bank holiday'
  return 'Paid holiday'
}

function groupByStatus(requests: HolidayRequest[]): Record<'Approved' | 'Pending', HolidayRequest[]> {
  return {
    Approved: requests.filter((request) => request.status === 'Approved'),
    Pending: requests.filter((request) => request.status === 'Pending'),
  }
}

function HolidayCalendarDayDetailsPanel({
  day,
  workersById,
  onDismiss,
}: {
  day: CalendarDay
  workersById: Map<string, Driver>
  onDismiss: () => void
}) {
  const dayRequests = dedupeRequestsByWorker(
    day.requests.map((request) => ({
      ...request,
      workerName: resolveCalendarWorkerName(request, workersById),
    })),
  )
  const dayGroups = groupByStatus(dayRequests)
  const hasWorkersOff = dayRequests.length > 0

  return (
    <div className="mt-4 rounded-[16px] border border-[#C5DFFB] bg-gradient-to-br from-white via-[#FAFCFF] to-[#EFF7FF] p-4 shadow-[0_12px_32px_rgba(17,60,105,0.14)] ring-1 ring-[#D3E9FC]/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#5499BF]">
            Selected day details
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#113C69] dark:text-slate-100">
            {new Intl.DateTimeFormat('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(day.date)}
          </h3>
          <p className="mt-1 text-sm text-[#5499BF]">
            {hasWorkersOff
              ? `${dayRequests.length} worker${dayRequests.length === 1 ? '' : 's'} away`
              : 'No workers off on this day.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-[10px] px-2 py-1 text-xs font-semibold text-[#5499BF] hover:bg-[#EFF7FF] hover:text-[#0B68BE]"
        >
          Clear
        </button>
      </div>

      {hasWorkersOff ? (
        <div className="mt-4 space-y-3">
          {(['Approved', 'Pending'] as const).map((status) =>
            dayGroups[status].length > 0 ? (
              <div key={status}>
                <p
                  className={`text-xs font-bold uppercase tracking-[0.06em] ${
                    status === 'Approved' ? 'text-teal-700' : 'text-amber-700'
                  }`}
                >
                  {getStatusLabel(status)}
                </p>
                <ul className="mt-2 space-y-2">
                  {dayGroups[status].map((request) => (
                    <li
                      key={request.id}
                      className={`rounded-[12px] border px-3 py-2 text-sm ${
                        request.status === 'Pending'
                          ? 'border-amber-200 bg-amber-50/90 text-amber-900'
                          : request.leaveType === 'unpaid_leave'
                            ? 'border-slate-200 bg-slate-50 text-slate-800'
                            : 'border-teal-200 bg-teal-50/90 text-teal-900'
                      }`}
                    >
                      <span className="font-semibold">{request.workerName}</span>
                      <span className="mt-0.5 block text-xs opacity-80">
                        {getLeaveTypeLabel(request)} · {formatDateRange(request)}
                        {request.holidayDaysDeducted > 0
                          ? ` · ${request.holidayDaysDeducted} days deducted`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  )
}

export function HolidayRequestsCalendar({
  requests,
  workers = [],
  isLoading = false,
  error = null,
  view,
  anchorDate,
  onViewChange,
  onAnchorDateChange,
  onRangeChange,
}: HolidayRequestsCalendarProps) {
  const { settings } = useCompanySettings()
  const workingDays = settings?.holidayWorkingDays ?? DEFAULT_HOLIDAY_WORKING_DAYS
  const workersById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  )
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const anchor = useMemo(() => parseIsoDate(anchorDate), [anchorDate])
  const today = toIsoDate(new Date())

  const range = useMemo(
    () => (view === 'month' ? getMonthGridRange(anchor) : getWeekRange(anchor)),
    [anchor, view],
  )

  useEffect(() => {
    onRangeChange(range)
  }, [onRangeChange, range])

  const requestsByDay = useMemo(
    () => buildHolidayRequestsByDay(requests, range.start, range.end),
    [range.end, range.start, requests],
  )

  const days = useMemo<CalendarDay[]>(() => {
    const items: CalendarDay[] = []
    let current = range.start

    while (current <= range.end) {
      const date = parseIsoDate(current)
      const dayRequests = requestsByDay.get(current) ?? []

      items.push({
        date,
        iso: current,
        label: String(date.getDate()),
        isToday: current === today,
        isNonWorkingDay: isNonWorkingDayDate(date, workingDays),
        isCurrentMonth: date.getMonth() === anchor.getMonth(),
        requests: dayRequests,
      })

      current = addDaysIso(current, 1)
    }

    return items
  }, [anchor, range.end, range.start, requestsByDay, today, workingDays])

  const periodLabel =
    view === 'month'
      ? MONTH_FORMATTER.format(anchor)
      : `${WEEK_RANGE_FORMATTER.format(parseIsoDate(range.start))} - ${WEEK_RANGE_FORMATTER.format(
          parseIsoDate(range.end),
        )}`

  const hasScheduledHolidays = days.some((day) => day.requests.length > 0)
  const selectedDayDetails = useMemo(
    () => (selectedDay ? (days.find((day) => day.iso === selectedDay) ?? null) : null),
    [days, selectedDay],
  )

  function movePeriod(direction: -1 | 1) {
    const next =
      view === 'month' ? addMonths(anchor, direction) : addDaysLocal(anchor, direction * 7)
    onAnchorDateChange(toIsoDate(next))
    setSelectedDay(null)
  }

  function goToToday() {
    onAnchorDateChange(today)
    setSelectedDay(null)
  }

  function jumpToMonth(month: number, year = anchor.getFullYear()) {
    onAnchorDateChange(toIsoDate(new Date(year, month, 1)))
    setSelectedDay(null)
  }

  function jumpToYear(year: number) {
    if (!Number.isFinite(year) || year < 1900 || year > 2200) return
    jumpToMonth(anchor.getMonth(), year)
  }

  return (
    <section className={`${holidayPageCardClass} p-4 sm:p-5 lg:p-6`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-[14px] bg-[#D3E9FC] text-[#0B68BE]">
              <CalendarDays className="size-4" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#113C69] dark:text-slate-100">
                Holiday Calendar
              </h2>
              <p className="mt-1 text-sm text-[#5499BF] dark:text-slate-400">
                See who is away and avoid too many workers off at the same time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="inline-flex rounded-[14px] border border-[#C5DFFB] bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
            {(['month', 'week'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onViewChange(option)
                  setSelectedDay(null)
                }}
                className={`rounded-[11px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                  view === option
                    ? 'bg-[#218EE7] text-white shadow-sm'
                    : 'text-[#5499BF] hover:bg-[#F5FAFF] hover:text-[#0B68BE] dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100'
                }`}
              >
                {option === 'month' ? 'Month' : 'Week'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {view === 'month' ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="holiday-calendar-month">
                  Select month
                </label>
                <select
                  id="holiday-calendar-month"
                  value={anchor.getMonth()}
                  onChange={(event) => jumpToMonth(Number(event.target.value))}
                  className={`${holidaySelectClass} h-9 min-w-32`}
                >
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="holiday-calendar-year">
                  Select year
                </label>
                <input
                  id="holiday-calendar-year"
                  type="number"
                  min={1900}
                  max={2200}
                  value={anchor.getFullYear()}
                  onChange={(event) => jumpToYear(Number.parseInt(event.target.value, 10))}
                  className={`${calendarInputClass} w-24`}
                  aria-label="Select year"
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="holiday-calendar-week-date"
                  className="text-xs font-bold uppercase tracking-[0.08em] text-[#5499BF] dark:text-slate-400"
                >
                  Week of
                </label>
                <input
                  id="holiday-calendar-week-date"
                  type="date"
                  value={anchorDate}
                  onChange={(event) => {
                    if (!event.target.value) return
                    onAnchorDateChange(event.target.value)
                    setSelectedDay(null)
                  }}
                  className={`${calendarInputClass} min-w-40`}
                />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => movePeriod(-1)}
              className="h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-2 text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
              aria-label={`Previous ${view}`}
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
              onClick={() => movePeriod(1)}
              className="h-9 rounded-[12px] border border-[#C5DFFB] bg-white/80 px-2 text-[#0B68BE] hover:bg-[#F5FAFF] dark:border-white/10 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800/50"
              aria-label={`Next ${view}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-semibold tracking-[-0.03em] text-[#113C69] dark:text-slate-100">
          {view === 'week' ? formatWeekRange(range.start, range.end) : periodLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700 ring-1 ring-teal-100">
            Approved
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-100">
            Pending
          </span>
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 ring-1 ring-orange-100">
            Over limit: {HOLIDAY_MAX_WORKERS_OFF_PER_DAY}
          </span>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto overflow-y-visible pb-1">
        <div className="min-w-[720px] overflow-visible sm:min-w-0">
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((day, index) => {
              const isNonWorkingHeader = !workingDays.includes(WEEKDAY_HEADER_KEYS[index])

              return (
                <div key={day} className={getWeekdayHeaderClass(isNonWorkingHeader)}>
                  {day}
                </div>
              )
            })}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2 overflow-visible">
            {days.map((day) => {
              const dayRequests = dedupeRequestsByWorker(
                day.requests.map((request) => ({
                  ...request,
                  workerName: resolveCalendarWorkerName(request, workersById),
                })),
              )
              const offCount = new Set(dayRequests.map((request) => request.workerId)).size
              const isOverLimit = offCount > HOLIDAY_MAX_WORKERS_OFF_PER_DAY
              const hasHoliday = dayRequests.length > 0
              const isSelectedDay = selectedDay === day.iso
              const hasApproved = dayRequests.some((request) => request.status === 'Approved')
              const hasPending = dayRequests.some((request) => request.status === 'Pending')
              const hasUnpaid = dayRequests.some((request) => request.leaveType === 'unpaid_leave')

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedDay(day.iso)}
                  className={`relative box-border flex h-[112px] min-h-[112px] flex-col overflow-hidden rounded-[16px] border p-2 text-left transition-[border-color,box-shadow,filter] sm:h-[132px] sm:min-h-[132px] ${
                    day.isCurrentMonth || view === 'week' || hasHoliday ? 'opacity-100' : 'opacity-55'
                  } ${getDayCellBackgroundClass(dayRequests, day.isNonWorkingDay)} ${
                    isOverLimit
                      ? 'border-orange-300 bg-orange-50/70 ring-2 ring-inset ring-orange-100'
                      : ''
                  } ${
                    day.isToday ? 'border-[#218EE7] ring-2 ring-inset ring-[#BFE3F5]' : ''
                  } ${
                    isSelectedDay
                      ? 'z-10 border-[#218EE7] ring-2 ring-inset ring-[#89CFF0]'
                      : 'z-0 hover:border-[#89CFF0] hover:ring-2 hover:ring-inset hover:ring-[#BFE3F5]/80 hover:brightness-[1.02]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-sm font-bold ${getDayNumberClass(
                        day.isToday,
                        day.isNonWorkingDay,
                      )}`}
                    >
                      {day.label}
                    </span>
                    {offCount > 0 ? (
                      <span className="rounded-full bg-[#D3E9FC] px-2 py-0.5 text-[11px] font-bold text-[#0B68BE]">
                        {offCount} off
                      </span>
                    ) : null}
                  </div>

                  {hasHoliday ? (
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-1.5">
                        {hasApproved ? (
                          <span
                            className="size-2.5 rounded-full bg-teal-500 ring-2 ring-white/80"
                            title="Approved"
                          />
                        ) : null}
                        {hasPending ? (
                          <span
                            className="size-2.5 rounded-full bg-amber-500 ring-2 ring-white/80"
                            title="Pending"
                          />
                        ) : null}
                        {hasUnpaid ? (
                          <span
                            className="size-2.5 rounded-full bg-slate-500 ring-2 ring-white/80"
                            title="Unpaid leave"
                          />
                        ) : null}
                        {isOverLimit ? (
                          <span
                            className="size-2.5 rounded-full bg-orange-600 ring-2 ring-white/80"
                            title="Over limit"
                          />
                        ) : null}
                      </div>
                      {isOverLimit ? (
                        <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 ring-1 ring-orange-200">
                          Limit
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {selectedDayDetails ? (
        <HolidayCalendarDayDetailsPanel
          day={selectedDayDetails}
          workersById={workersById}
          onDismiss={() => setSelectedDay(null)}
        />
      ) : null}

      {!isLoading && !error && !hasScheduledHolidays ? (
        <div className="mt-4 rounded-[16px] border border-dashed border-[#BFE3F5] bg-white/70 px-4 py-6 text-center text-sm font-medium text-[#5499BF] dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-400">
          No holidays scheduled for this period.
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 rounded-[16px] bg-white/70 px-4 py-3 text-sm font-medium text-[#5499BF] dark:bg-slate-900/70 dark:text-slate-400">
          Loading calendar holidays…
        </div>
      ) : null}
    </section>
  )
}
