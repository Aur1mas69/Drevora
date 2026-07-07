import type { HolidayBalanceSummary, HolidayDayBreakdown } from '@/lib/holidayRequestTypes'

type HolidayDayBreakdownSummaryProps = {
  breakdown: HolidayDayBreakdown | HolidayBalanceSummary
  isLoadingBalance?: boolean
  balanceError?: string | null
}

function formatDayCount(value: number): string {
  return `${value} day${value === 1 ? '' : 's'}`
}

export function HolidayDayBreakdownSummary({
  breakdown,
  isLoadingBalance = false,
  balanceError = null,
}: HolidayDayBreakdownSummaryProps) {
  const balance =
    'remainingAfterRequest' in breakdown ? (breakdown as HolidayBalanceSummary) : null
  const isUnpaidLeave = balance !== null && balance.holidayDaysDeducted === 0 && balance.calendarDaysTotal > 0

  return (
    <div className="rounded-2xl border border-[#D3E9FC] bg-gradient-to-br from-[#FAFCFF] to-[#EEF6FF] p-4 shadow-sm shadow-[#BDDDFB]/25">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#218EE7]">
        Holiday day calculation
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {balance ? (
          <>
            <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
              <dt className="text-xs font-medium text-[#5499BF]">Paid holiday entitlement</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
                {balance.allowanceKnown ? formatDayCount(balance.annualAllowance) : 'Allowance not set'}
              </dd>
            </div>
            <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
              <dt className="text-xs font-medium text-[#5499BF]">Bank holiday entitlement</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
                {formatDayCount(balance.bankHolidayEntitlementDays)}
              </dd>
            </div>
            <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
              <dt className="text-xs font-medium text-[#5499BF]">Used paid holiday</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
                {formatDayCount(balance.usedHolidayDays)}
              </dd>
            </div>
            <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
              <dt className="text-xs font-medium text-[#5499BF]">Pending paid holiday</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
                {formatDayCount(balance.pendingHolidayDays)}
              </dd>
            </div>
            <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
              <dt className="text-xs font-medium text-[#5499BF]">Remaining after pending</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
                {balance.allowanceKnown && Number.isFinite(balance.remainingAfterPendingRequests)
                  ? formatDayCount(balance.remainingAfterPendingRequests)
                  : 'Allowance not set'}
              </dd>
            </div>
          </>
        ) : null}
        <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
          <dt className="text-xs font-medium text-[#5499BF]">Calendar days</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
            {formatDayCount(breakdown.calendarDaysTotal)}
          </dd>
        </div>
        <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
          <dt className="text-xs font-medium text-[#5499BF]">Holiday days deducted</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
            {isUnpaidLeave ? '0 paid days (unpaid)' : formatDayCount(breakdown.holidayDaysDeducted)}
          </dd>
        </div>
        <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
          <dt className="text-xs font-medium text-[#5499BF]">
            Weekend / non-working days excluded
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[#113C69]">
            {formatDayCount(breakdown.nonWorkingDaysExcluded)}
          </dd>
        </div>
        <div className="rounded-[14px] bg-white/75 px-3 py-2 ring-1 ring-[#D3E9FC]/80">
          <dt className="text-xs font-medium text-[#5499BF]">Remaining after request</dt>
          <dd
            className={`mt-0.5 font-semibold tabular-nums ${
              balance &&
              balance.allowanceKnown &&
              Number.isFinite(balance.remainingAfterRequest) &&
              balance.remainingAfterRequest < 0
                ? 'text-rose-700'
                : 'text-[#113C69]'
            }`}
          >
            {isLoadingBalance
              ? 'Checking...'
              : balance && !balance.allowanceKnown
                ? 'Allowance not set'
                : balance && Number.isFinite(balance.remainingAfterRequest)
                  ? formatDayCount(balance.remainingAfterRequest)
                  : 'Not available'}
          </dd>
        </div>
      </dl>
      {balance &&
      balance.allowanceKnown &&
      balance.bankHolidayEntitlementDays > 0 ? (
        <p className="mt-3 text-xs leading-5 text-[#5499BF]">
          Bank holidays are tracked separately and are not included in remaining paid holiday.
        </p>
      ) : null}
      {balanceError ? <p className="mt-3 text-xs font-medium text-rose-700">{balanceError}</p> : null}
      {balance &&
      balance.allowanceKnown &&
      Number.isFinite(balance.remainingAfterRequest) &&
      balance.remainingAfterRequest < 0 ? (
        <p className="mt-3 text-xs font-medium text-rose-700">
          This request exceeds the worker holiday allowance by{' '}
          {formatDayCount(Math.abs(balance.remainingAfterRequest))}.
        </p>
      ) : null}
    </div>
  )
}
