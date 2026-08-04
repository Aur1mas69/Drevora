import {
  enumerateInclusiveDates,
  resolvePortionForDate,
  type ApprovedHolidayDay,
} from '@/lib/timesheetHoliday'
import {
  fetchHolidayCalendarRequests,
  HolidayRequestsServiceError,
} from '@/services/holidayRequestsService'

/** Approved holiday request day portions overlapping a Timesheet week for one worker. */
export async function fetchApprovedHolidayDaysForWorkerWeek(input: {
  workerId: string
  weekStart: string
  weekEnd: string
}): Promise<ApprovedHolidayDay[]> {
  const days: ApprovedHolidayDay[] = []
  try {
    const requests = await fetchHolidayCalendarRequests({
      dateFrom: input.weekStart,
      dateTo: input.weekEnd,
      workerId: input.workerId,
      statuses: ['Approved'],
    })
    for (const request of requests) {
      for (const day of enumerateInclusiveDates(request.startDate, request.endDate)) {
        if (day < input.weekStart || day > input.weekEnd) continue
        days.push({
          dayDate: day,
          portion: resolvePortionForDate(
            day,
            request.startDate,
            request.endDate,
            request.startDayPortion,
            request.endDayPortion,
          ),
        })
      }
    }
  } catch (error) {
    if (!(error instanceof HolidayRequestsServiceError)) throw error
  }
  return days
}

/** @deprecated Prefer fetchApprovedHolidayDaysForWorkerWeek for half-day support. */
export async function fetchApprovedHolidayDatesForWorkerWeek(input: {
  workerId: string
  weekStart: string
  weekEnd: string
}): Promise<Set<string>> {
  const days = await fetchApprovedHolidayDaysForWorkerWeek(input)
  return new Set(days.map((day) => day.dayDate))
}
