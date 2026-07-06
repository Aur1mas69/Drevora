import { HolidayDateInput } from '@/components/holidays/HolidayDateInput'
import { HolidayDatePickerGroup } from '@/components/holidays/HolidayDatePickerGroup'
import { Button } from '@/components/ui/button'
import type { HolidayBalanceSummary } from '@/lib/holidayRequestTypes'
import {
  myHolidayCardClass,
  myHolidayPrimaryButtonClass,
  myHolidaySectionEyebrowClass,
  myHolidaySectionTitleClass,
} from './myHolidayUiStyles'

type MyHolidayBookCardProps = {
  startDate: string
  endDate: string
  reason: string
  preview: HolidayBalanceSummary | null
  isPreviewLoading: boolean
  isSubmitting: boolean
  showManagedMessage: boolean
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onReasonChange: (value: string) => void
  onSubmit: () => void
}

function formatDayCount(value: number): string {
  return `${value} day${value === 1 ? '' : 's'}`
}

export function MyHolidayBookCard({
  startDate,
  endDate,
  reason,
  preview,
  isPreviewLoading,
  isSubmitting,
  showManagedMessage,
  onStartDateChange,
  onEndDateChange,
  onReasonChange,
  onSubmit,
}: MyHolidayBookCardProps) {
  const hasDates = startDate.length > 0 && endDate.length > 0
  const exceedsBalance =
    preview &&
    preview.allowanceKnown &&
    Number.isFinite(preview.remainingAfterRequest) &&
    preview.remainingAfterRequest < 0

  return (
    <section className={myHolidayCardClass}>
      <p className={myHolidaySectionEyebrowClass}>Book holiday</p>
      <h2 className={`mt-1 ${myHolidaySectionTitleClass}`}>Request time off</h2>

      {showManagedMessage ? (
        <p className="mt-3 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
          Your holiday balance is managed by your company.
        </p>
      ) : null}

      <HolidayDatePickerGroup>
        <div className="mt-4 space-y-3">
          <label className="block min-w-0 space-y-1.5">
            <span className="text-xs font-semibold text-[#5499BF]">Start date</span>
            <HolidayDateInput
              value={startDate}
              onChange={onStartDateChange}
              className="h-11 rounded-[14px] border-[#C5DFFB]/80 bg-white"
              layout="modal"
              blurOnSelect
              aria-label="Start date"
            />
          </label>
          <label className="block min-w-0 space-y-1.5">
            <span className="text-xs font-semibold text-[#5499BF]">End date</span>
            <HolidayDateInput
              value={endDate}
              onChange={onEndDateChange}
              min={startDate || undefined}
              className="h-11 rounded-[14px] border-[#C5DFFB]/80 bg-white"
              layout="modal"
              blurOnSelect
              aria-label="End date"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#5499BF]">Reason (optional)</span>
            <textarea
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              rows={3}
              placeholder="Add a short note for your manager"
              className="w-full resize-none rounded-[14px] border border-[#C5DFFB]/80 bg-white px-3 py-2.5 text-sm font-medium text-[#113C69] shadow-sm outline-none transition-colors placeholder:text-[#5499BF]/70 focus:border-[#89CFF0] focus:ring-2 focus:ring-[#BFE3F5]/70"
            />
          </label>
        </div>
      </HolidayDatePickerGroup>

      {hasDates ? (
        <div className="mt-4 rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#218EE7]">
            Request summary
          </p>
          {isPreviewLoading ? (
            <p className="mt-2 text-sm text-[#5499BF]">Calculating days…</p>
          ) : preview ? (
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  Calendar
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                  {formatDayCount(preview.calendarDaysTotal)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  Holiday days
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-[#113C69]">
                  {formatDayCount(preview.holidayDaysDeducted)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5499BF]">
                  Remaining
                </dt>
                <dd
                  className={`mt-0.5 text-sm font-bold tabular-nums ${
                    exceedsBalance ? 'text-rose-600' : 'text-[#113C69]'
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
            <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
              This request is higher than your current balance. Your manager will review it.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button
        type="button"
        disabled={!hasDates || isSubmitting || isPreviewLoading}
        onClick={onSubmit}
        className={`mt-4 ${myHolidayPrimaryButtonClass}`}
      >
        {isSubmitting ? 'Submitting…' : 'Submit request'}
      </Button>
    </section>
  )
}
