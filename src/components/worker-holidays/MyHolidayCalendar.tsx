import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import { getGlobalWeekStarts, getWeekdayLabels } from '@/lib/dateTimeFormat'
import type { HolidayRequest, HolidayRequestStatus } from '@/lib/holidayRequestTypes'
import {
  buildHolidayRequestsByDay,
  normalizeHolidayIsoDate,
  toLocalIsoDate,
} from '@/lib/holidayRequestUtils'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  myHolidayCardClass,
  myHolidaySectionEyebrowClass,
  myHolidaySectionTitleClass,
} from './myHolidayUiStyles'

type MyHolidayCalendarProps = {
  requests: HolidayRequest[]
  isLoading?: boolean
}

function getWeekStartOffset(weekStarts: 'monday' | 'sunday'): number {
  return weekStarts === 'sunday' ? 0 : 1
}

function buildMonthGrid(year: number, month: number, weekStarts: 'monday' | 'sunday') {
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() - getWeekStartOffset(weekStarts) + 7) % 7
  const startDate = new Date(year, month, 1 - startOffset)
  const days: Array<{ iso: string; inMonth: boolean; day: number }> = []

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    days.push({
      iso: toLocalIsoDate(date),
      inMonth: date.getMonth() === month,
      day: date.getDate(),
    })
  }

  return days
}

function resolveDayStatus(requests: HolidayRequest[]): HolidayRequestStatus | null {
  if (requests.length === 0) return null
  const priority: HolidayRequestStatus[] = ['Approved', 'Pending', 'Rejected', 'Cancelled']
  for (const status of priority) {
    if (requests.some((request) => request.status === status)) return status
  }
  return requests[0]?.status ?? null
}

function dayStatusClass(status: HolidayRequestStatus | null): string {
  switch (status) {
    case 'Approved':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
    case 'Pending':
      return 'bg-amber-100 text-amber-800 ring-amber-200'
    case 'Rejected':
      return 'bg-rose-100 text-rose-800 ring-rose-200'
    default:
      return 'text-[#113C69] hover:bg-[#EEF6FF]'
  }
}

function statusLabel(status: HolidayRequestStatus): string {
  if (status === 'Rejected') return 'Declined'
  return status
}

export function MyHolidayCalendar({ requests, isLoading = false }: MyHolidayCalendarProps) {
  const { weekStarts: contextWeekStarts, formatDate } = useCompanySettings()
  const weekStarts = contextWeekStarts ?? getGlobalWeekStarts()
  const [anchor, setAnchor] = useState(() => new Date())
  const [selectedIso, setSelectedIso] = useState<string | null>(null)

  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(anchor)

  const monthStart = toLocalIsoDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  const monthEnd = toLocalIsoDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0))
  const requestsByDay = useMemo(
    () => buildHolidayRequestsByDay(requests, monthStart, monthEnd),
    [monthEnd, monthStart, requests],
  )
  const days = useMemo(
    () => buildMonthGrid(anchor.getFullYear(), anchor.getMonth(), weekStarts),
    [anchor, weekStarts],
  )
  const weekdayLabels = getWeekdayLabels(weekStarts)
  const selectedRequests = selectedIso ? requestsByDay.get(selectedIso) ?? [] : []

  function moveMonth(delta: number) {
    setAnchor((current) => {
      const next = new Date(current)
      next.setMonth(current.getMonth() + delta)
      return next
    })
    setSelectedIso(null)
  }

  return (
    <section className={myHolidayCardClass}>
      <p className={myHolidaySectionEyebrowClass}>My Holiday Calendar</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className={myHolidaySectionTitleClass}>{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="inline-flex size-9 items-center justify-center rounded-[12px] border border-[#C5DFFB] bg-white text-[#0B68BE]"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="inline-flex size-9 items-center justify-center rounded-[12px] border border-[#C5DFFB] bg-white text-[#0B68BE]"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-[#5499BF]">Loading calendar…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[10px] font-bold uppercase tracking-[0.06em] text-[#5499BF]"
              >
                {label}
              </div>
            ))}
            {days.map((day) => {
              const dayRequests = requestsByDay.get(day.iso) ?? []
              const status = resolveDayStatus(dayRequests)
              const isSelected = selectedIso === day.iso
              const isToday = day.iso === toLocalIsoDate(new Date())

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedIso(day.iso)}
                  className={cn(
                    'flex h-10 flex-col items-center justify-center rounded-[10px] text-xs font-semibold tabular-nums ring-1 ring-transparent transition-colors',
                    !day.inMonth && 'opacity-40',
                    status ? dayStatusClass(status) : 'text-[#113C69] hover:bg-[#EEF6FF]',
                    isSelected && 'ring-2 ring-[#218EE7]',
                    isToday && !status && 'ring-1 ring-[#89CFF0]',
                  )}
                >
                  {day.day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-[#5499BF]">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-emerald-400" />
              Approved
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-amber-400" />
              Pending
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-rose-400" />
              Declined
            </span>
          </div>

          {selectedIso && selectedRequests.length > 0 ? (
            <div className="mt-4 rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#218EE7]">
                {formatDate(selectedIso)}
              </p>
              {selectedRequests.map((request) => (
                <div key={request.id} className="mt-2 text-sm text-[#113C69]">
                  <p className="font-semibold">{statusLabel(request.status)}</p>
                  <p className="mt-0.5 text-xs text-[#5499BF]">
                    {formatDate(normalizeHolidayIsoDate(request.startDate))} –{' '}
                    {formatDate(normalizeHolidayIsoDate(request.endDate))}
                    {' · '}
                    {request.holidayDaysDeducted || request.calendarDaysTotal} day
                    {(request.holidayDaysDeducted || request.calendarDaysTotal) === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
