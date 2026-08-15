import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  formatWorkerHolidayDays,
  formatWorkerHolidayPortionSummary,
  holidayStatusI18nKey,
} from '@/i18n/workerPhase3bDisplay'
import type { HolidayRequest } from '@/lib/holidayRequestTypes'
import { getStatusBadgeClass } from '@/lib/holidayRequestUtils'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('worker')
  const { formatDate, formatDateTime } = useCompanySettings()

  return (
    <section className={myHolidayCardClass}>
      <p className={myHolidaySectionEyebrowClass}>{t('holidays.requestsEyebrow')}</p>
      <h2 className={`mt-1 ${myHolidaySectionTitleClass}`}>{t('holidays.historyTitle')}</h2>

      {isLoading ? (
        <p className="my-holiday-muted mt-4 text-sm text-[#5499BF]">{t('holidays.loadingRequests')}</p>
      ) : requests.length === 0 ? (
        <div className="my-holiday-selected-panel mt-4 rounded-[14px] border border-dashed border-[#C5DFFB] bg-[#F8FBFF] px-4 py-8 text-center">
          <p className="my-holiday-body text-sm font-semibold text-[#113C69]">{t('holidays.emptyTitle')}</p>
          <p className="my-holiday-muted mt-1 text-xs text-[#5499BF]">
            {t('holidays.emptyBody')}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="my-holiday-selected-panel rounded-[14px] border border-[#D3E9FC] bg-white/80 p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="my-holiday-body text-sm font-semibold text-[#113C69]">
                    {formatDate(request.startDate)} – {formatDate(request.endDate)}
                  </p>
                  <p className="my-holiday-muted mt-1 text-xs text-[#5499BF]">
                    {formatWorkerHolidayPortionSummary(request, t)} ·{' '}
                    {formatWorkerHolidayDays(
                      request.holidayDaysDeducted || request.calendarDaysTotal,
                      t,
                    )}{' '}
                    · {t('holidays.requested', { when: formatDateTime(request.createdAt) })}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${getStatusBadgeClass(request.status)}`}
                >
                  {t(holidayStatusI18nKey(request.status))}
                </span>
              </div>
              {request.reason?.trim() ? (
                <p className="my-holiday-muted mt-2 line-clamp-2 text-xs leading-relaxed text-[#3D7A9C]">
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
