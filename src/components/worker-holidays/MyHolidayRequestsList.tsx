import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
import { getStatusBadgeClass, getStatusLabel } from '@/lib/holidayRequestUtils'
import {
  myHolidayCardClass,
  myHolidaySectionEyebrowClass,
  myHolidaySectionTitleClass,
} from './myHolidayUiStyles'

type MyHolidayRequestsListProps = {
  requests: HolidayRequest[]
  isLoading?: boolean
}

export function MyHolidayRequestsList({
  requests,
  isLoading = false,
}: MyHolidayRequestsListProps) {
  const { formatDate, formatDateTime } = useCompanySettings()

  return (
    <section className={myHolidayCardClass}>
      <p className={myHolidaySectionEyebrowClass}>My Requests</p>
      <h2 className={`mt-1 ${myHolidaySectionTitleClass}`}>Holiday history</h2>

      {isLoading ? (
        <p className="mt-4 text-sm text-[#5499BF]">Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-dashed border-[#C5DFFB] bg-[#F8FBFF] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#113C69]">No holiday requests yet.</p>
          <p className="mt-1 text-xs text-[#5499BF]">
            Book time off above and your requests will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="rounded-[14px] border border-[#D3E9FC] bg-white/80 p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#113C69]">
                    {formatDate(request.startDate)} – {formatDate(request.endDate)}
                  </p>
                  <p className="mt-1 text-xs text-[#5499BF]">
                    {request.holidayDaysDeducted || request.calendarDaysTotal} day
                    {(request.holidayDaysDeducted || request.calendarDaysTotal) === 1
                      ? ''
                      : 's'}{' '}
                    · Requested {formatDateTime(request.createdAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(request.status)}`}
                >
                  {getStatusLabel(request.status)}
                </span>
              </div>
              {request.reason?.trim() ? (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#3D7A9C]">
                  {request.reason.trim()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
