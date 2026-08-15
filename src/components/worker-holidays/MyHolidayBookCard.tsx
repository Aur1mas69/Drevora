import { HolidayDateInput } from '@/components/holidays/HolidayDateInput'
import { HolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { HolidayDayPortionSelect } from '@/components/holidays/HolidayDayPortionSelect'
import { Button } from '@/components/ui/button'
import {
  formatWorkerHolidayDays,
  getWorkerWeekdayLabels,
  holidayPortionLabel,
} from '@/i18n/workerPhase3bDisplay'
import { workerIntlLocale } from '@/i18n/workerTimesheetDisplay'
import type { HolidayBalanceSummary, HolidayDayPortion } from '@/lib/holidayRequestTypes'
import { isSingleHolidayRequestDay } from '@/lib/holidayRequestUtils'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  myHolidayCardClass,
  myHolidayPrimaryButtonClass,
  myHolidaySectionEyebrowClass,
  myHolidaySectionTitleClass,
} from './myHolidayUiStyles'

type MyHolidayBookCardProps = {
  startDate: string
  endDate: string
  startDayPortion: HolidayDayPortion
  reason: string
  preview: HolidayBalanceSummary | null
  isPreviewLoading: boolean
  isSubmitting: boolean
  showManagedMessage: boolean
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onStartDayPortionChange: (value: HolidayDayPortion) => void
  onReasonChange: (value: string) => void
  onSubmit: () => void
}

export function MyHolidayBookCard({
  startDate,
  endDate,
  startDayPortion,
  reason,
  preview,
  isPreviewLoading,
  isSubmitting,
  showManagedMessage,
  onStartDateChange,
  onEndDateChange,
  onStartDayPortionChange,
  onReasonChange,
  onSubmit,
}: MyHolidayBookCardProps) {
  const { t, i18n } = useTranslation('worker')
  const [requestEndOpen, setRequestEndOpen] = useState(false)
  const dateChrome = useMemo(
    () => ({
      locale: workerIntlLocale(i18n.language),
      weekdayLabels: getWorkerWeekdayLabels('monday', i18n.language),
      previousMonth: t('holidays.previousMonth'),
      nextMonth: t('holidays.nextMonth'),
      selectDate: t('holidays.selectDate'),
      clearDate: t('holidays.clearDate'),
      openCalendar: t('holidays.openCalendar'),
      namedCalendar: (label: string) => t('holidays.namedCalendar', { label }),
      clearNamedDate: (label: string) => t('holidays.clearNamedDate', { label }),
    }),
    [i18n.language, t],
  )
  const hasDates = startDate.length > 0 && endDate.length > 0
  const isSingleDay = isSingleHolidayRequestDay(startDate, endDate)
  const exceedsBalance =
    preview &&
    preview.allowanceKnown &&
    Number.isFinite(preview.remainingAfterRequest) &&
    preview.remainingAfterRequest < 0

  return (
    <section className={myHolidayCardClass}>
      <p className={myHolidaySectionEyebrowClass}>{t('holidays.bookEyebrow')}</p>
      <h2 className={`mt-1.5 ${myHolidaySectionTitleClass}`}>{t('holidays.bookTitle')}</h2>

      {showManagedMessage ? (
        <p className="my-holiday-notice mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
          {t('holidays.managed')}
        </p>
      ) : null}

      <HolidayDatePickerGroup>
        <div className="mt-5 space-y-3.5">
          {/* Not a <label>: label activation would forward day taps back to the input. */}
          <div className="block min-w-0 space-y-1.5">
            <span className="my-holiday-muted text-xs font-semibold text-[#5499BF]">{t('holidays.startDate')}</span>
            <HolidayDateInput
              value={startDate}
              onChange={(value) => {
                onStartDateChange(value)
                if (!endDate || (value && endDate < value)) {
                  setRequestEndOpen(true)
                }
              }}
              className="my-holiday-input h-11 rounded-2xl border-[#C5DFFB]/80 bg-white"
              layout="modal"
              blurOnSelect
              aria-label={t('holidays.startDate')}
              chrome={dateChrome}
            />
          </div>
          <div className="block min-w-0 space-y-1.5">
            <span className="my-holiday-muted text-xs font-semibold text-[#5499BF]">{t('holidays.endDate')}</span>
            <HolidayDateInput
              value={endDate}
              onChange={onEndDateChange}
              min={startDate || undefined}
              className="my-holiday-input h-11 rounded-2xl border-[#C5DFFB]/80 bg-white"
              layout="modal"
              blurOnSelect
              requestOpen={requestEndOpen}
              onRequestOpenHandled={() => setRequestEndOpen(false)}
              aria-label={t('holidays.endDate')}
              chrome={dateChrome}
            />
          </div>
          {isSingleDay ? (
            <HolidayDayPortionSelect
              label={t('holidays.dayType')}
              value={startDayPortion}
              onChange={onStartDayPortionChange}
              optionLabels={{
                full: holidayPortionLabel('full', t),
                first_half: holidayPortionLabel('first_half', t),
                second_half: holidayPortionLabel('second_half', t),
              }}
              className="my-holiday-muted text-xs font-semibold text-[#5499BF] [&_select]:my-holiday-input [&_select]:h-11 [&_select]:rounded-2xl [&_select]:border-[#C5DFFB]/80 [&_select]:bg-white [&_select]:text-[#113C69]"
            />
          ) : null}
          <label className="block space-y-1.5">
            <span className="my-holiday-muted text-xs font-semibold text-[#5499BF]">{t('holidays.reasonOptional')}</span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={3}
              placeholder={t('holidays.reasonPlaceholder')}
              className="my-holiday-input my-holiday-body w-full resize-none rounded-2xl border border-[#C5DFFB]/80 bg-white px-3 py-2.5 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors placeholder:text-[#5499BF]/70 focus:border-[#89CFF0] focus:ring-2 focus:ring-[#BFE3F5]/70"
            />
          </label>
        </div>
      </HolidayDatePickerGroup>

      {hasDates ? (
        <div className="my-holiday-selected-panel mt-5 rounded-2xl border border-[#D3E9FC] bg-white/80 p-3.5 shadow-[0_1px_3px_rgba(33,142,231,0.06)]">
          <p className="my-holiday-eyebrow text-xs font-bold uppercase tracking-[0.1em] text-[#218EE7]">
            {t('holidays.summary')}
          </p>
          {isPreviewLoading ? (
            <p className="my-holiday-muted mt-2 text-sm text-[#5499BF]">{t('holidays.calculating')}</p>
          ) : preview ? (
            <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="my-holiday-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  {t('holidays.calendarDays')}
                </dt>
                <dd className="my-holiday-body mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                  {formatWorkerHolidayDays(preview.calendarDaysTotal, t)}
                </dd>
              </div>
              <div>
                <dt className="my-holiday-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  {t('holidays.holidayDays')}
                </dt>
                <dd className="my-holiday-body mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                  {formatWorkerHolidayDays(preview.holidayDaysDeducted, t)}
                </dd>
              </div>
              <div>
                <dt className="my-holiday-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  {t('holidays.remaining')}
                </dt>
                <dd
                  className={`mt-0.5 text-sm font-bold tabular-nums ${
                    exceedsBalance ? 'text-rose-600' : 'my-holiday-body text-[#113C69]'
                  }`}
                >
                  {preview.allowanceKnown && Number.isFinite(preview.remainingAfterRequest)
                    ? formatWorkerHolidayDays(preview.remainingAfterRequest, t)
                    : '—'}
                </dd>
              </div>
            </dl>
          ) : null}
          {exceedsBalance ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
              {t('holidays.exceedsBalance')}
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        disabled={!hasDates || isSubmitting || isPreviewLoading}
        onClick={onSubmit}
        className={`mt-5 ${myHolidayPrimaryButtonClass}`}
      >
        {isSubmitting ? t('holidays.submitting') : t('holidays.submitRequest')}
      </Button>
    </section>
  )
}
