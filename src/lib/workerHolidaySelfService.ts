import type { HolidayBalanceSummary, HolidayLeaveType } from '@/lib/holidayRequestTypes'
import type { Driver } from '@/services/driversService'

export function resolveSelfServiceHolidayLeaveType(
  paidHolidayEnabled: boolean | null | undefined,
): HolidayLeaveType {
  return paidHolidayEnabled === false ? 'unpaid_leave' : 'paid_holiday'
}

export function workerHasPaidHolidayEntitlement(worker: Driver): boolean {
  return worker.paidHolidayEnabled !== false
}

export type WorkerHolidayBalanceView = {
  remainingDays: number | null
  usedDays: number
  pendingDays: number
  totalEntitlement: number | null
  allowanceKnown: boolean
}

export function buildWorkerHolidayBalanceView(
  balance: HolidayBalanceSummary | null,
): WorkerHolidayBalanceView {
  const usedDays = balance?.usedHolidayDays ?? 0
  const pendingDays = balance?.pendingHolidayDays ?? 0
  const allowanceKnown = balance?.allowanceKnown ?? false
  const totalEntitlement = allowanceKnown ? balance?.annualAllowance ?? 0 : null
  const remainingDays =
    balance && allowanceKnown && Number.isFinite(balance.remainingBeforeRequest)
      ? balance.remainingBeforeRequest
      : null

  return {
    remainingDays,
    usedDays,
    pendingDays,
    totalEntitlement,
    allowanceKnown,
  }
}

export function formatWorkerHolidayDayCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return String(Math.round(value * 10) / 10)
}
