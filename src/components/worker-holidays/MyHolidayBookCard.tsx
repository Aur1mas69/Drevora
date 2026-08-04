import { HolidayDateInput } from '@/components/holidays/HolidayDateInput'
import { HolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { HolidayDayPortionSelect } from '@/components/holidays/HolidayDayPortionSelect'
import { Button } from '@/components/ui/button'
import type { HolidayBalanceSummary, HolidayDayPortion } from '@/lib/holidayRequestTypes'
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
  endDayPortion: HolidayDayPortion
  reason: string
  preview: HolidayBalanceSummary | null
  isPreviewLoading: boolean
  isSubmitting: boolean
  showManagedMessage: boolean
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onStartDayPortionChange: (value: HolidayDayPortion) => void
  onEndDayPortionChange: (value: HolidayDayPortion) => void
  onReasonChange: (value: string) => void
  onSubmit: () => void
}

function formatDayCount(value: number): string {
  return `${value} day${value === 1 ? '' : 's'}`
}

export function MyHolidayBookCard({
  startDate,
  endDate,
  startDayPortion,
  endDayPortion,
  reason,
  preview,
  isPreviewLoading,
  isSubmitting,
  showManagedMessage,
  onStartDateChange,
  onEndDateChange,
  onStartDayPortionChange,
  onEndDayPortionChange,
  onReasonChange,
  onSubmit,
}: MyHolidayBookCardProps) {
  const hasDates = startDate.length > 0 && endDate.length > 0
  const isSingleDay = Boolean(startDate && endDate && startDate === endDate)
  const exceedsBalance =
    preview &&
    preview.allowanceKnown &&
    Number.isFinite(preview.remainingAfterRequest) &&
    preview.remainingAfterRequest < 0

  return (
    <section className={myHolidayCardClass}>
      <p className={myHolidaySectionEyebrowClass}>Book holiday</p>
      <h2 className={`mt-1.5 ${myHolidaySectionTitleClass}`}>Request time off</h2>

      {showManagedMessage ? (
        <p className="my-holiday-notice mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
          Your holiday balance is managed by your company.
        </p>
      ) : null}

      <HolidayDatePickerGroup>
        <div className="mt-5 space-y-3.5">
          <label className="block min-w-0 space-y-1.5">
            <span className="my-holiday-muted text-xs font-semibold text-[#5499BF]">Start date</span>
            <HolidayDateInput
              value={startDate}
              onChange={onStartDateChange}
              className="my-holiday-input h-11 rounded-2xl border-[#C5DFFB]/80 bg-white"
              layout="modal"
              blurOnSelect
              aria-label="Start date"
            />
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="my-holiday-muted text-xs font-semibold text-[#5499BF]">End date</span>
            <HolidayDateInput
              value={endDate}
              onChange={onEndDateChange}
              min={startDate || undefined}
              className="my-holiday-input h-11 rounded-2xl border-[#C5DFFB]/80 bg-white"
              layout="modal"
              blurOnSelect
              aria-label="End date"
            />
          </label>
          <HolidayDayPortionSelect
            label={isSingleDay ? 'Day portion' : 'Start day portion'}
            value={startDayPortion}
            onChange={(value) => {
              onStartDayPortionChange(value)
              if (isSingleDay) onEndDayPortionChange(value)
            }}
            className="my-holiday-muted text-xs font-semibold text-[#5499BF] [&_select]:my-holiday-input [&_select]:h-11 [&_select]:rounded-2xl [&_select]:border-[#C5DFFB]/80 [&_select]:bg-white [&_select]:text-[#113C69]"
          />
          {!isSingleDay ? (
            <HolidayDayPortionSelect
              label="End day portion"
              value={endDayPortion}
              onChange={onEndDayPortionChange}
              className="my-holiday-muted text-xs font-semibold text-[#5499BF] [&_select]:my-holiday-input [&_select]:h-11 [&_select]:rounded-2xl [&_select]:border-[#C5DFFB]/80 [&_select]:bg-white [&_select]:text-[#113C69]"
            />
          ) : null}
          <label className="block space-y-1.5">
            <span className="my-holiday-muted text-xs font-semibold text-[#5499BF]">Reason (optional)</span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={3}
              placeholder="Add a short note for your manager"
              className="my-holiday-input my-holiday-body w-full resize-none rounded-2xl border border-[#C5DFFB]/80 bg-white px-3 py-2.5 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors placeholder:text-[#5499BF]/70 focus:border-[#89CFF0] focus:ring-2 focus:ring-[#BFE3F5]/70"
            />
          </label>
        </div>
      </HolidayDatePickerGroup>

      {hasDates ? (
        <div className="my-holiday-selected-panel mt-5 rounded-2xl border border-[#D3E9FC] bg-white/80 p-3.5 shadow-[0_1px_3px_rgba(33,142,231,0.06)]">
          <p className="my-holiday-eyebrow text-xs font-bold uppercase tracking-[0.1em] text-[#218EE7]">
            Request summary
          </p>
          {isPreviewLoading ? (
            <p className="my-holiday-muted mt-2 text-sm text-[#5499BF]">Calculating days…</p>
          ) : preview ? (
            <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="my-holiday-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  Calendar
                </dt>
                <dd className="my-holiday-body mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                  {formatDayCount(preview.calendarDaysTotal)}
                </dd>
              </div>
              <div>
                <dt className="my-holiday-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  Holiday days
                </dt>
                <dd className="my-holiday-body mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                  {formatDayCount(preview.holidayDaysDeducted)}
                </dd>
              </div>
              <div>
                <dt className="my-holiday-muted text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  Remaining
                </dt>
                <dd
                  className={`mt-0.5 text-sm font-bold tabular-nums ${
                    exceedsBalance ? 'text-rose-600' : 'my-holiday-body text-[#113C69]'
                  }`}
                >
                  {preview.allowanceKnown && Number.isFinite(preview.remainingAfterRequest)
                    ? formatDayCount(preview.remainingAfterRequest)
                    : '—'}
                </dd>
              </div>
            </dl>
          ) : null}
          {exceedsBalance ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
              This request is higher than your current balance. Your manager will review it.
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
        {isSubmitting ? 'Submitting…' : 'Submit request'}
      </Button>
    </section>
  )
}
