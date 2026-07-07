export function resolvePaidHolidayEntitlementDays(
  paidHolidayEnabled: boolean,
  annualPaidHolidayDays: number,
): number {
  return paidHolidayEnabled ? annualPaidHolidayDays : 0
}

export function calculatePaidHolidayRemaining(input: {
  annualPaidHolidayDays: number
  usedPaidHoliday: number
  pendingPaidHoliday?: number
}): {
  remainingPaidHoliday: number
  remainingAfterPending: number
} {
  const { annualPaidHolidayDays, usedPaidHoliday, pendingPaidHoliday = 0 } = input
  const remainingPaidHoliday = annualPaidHolidayDays - usedPaidHoliday
  const remainingAfterPending = annualPaidHolidayDays - usedPaidHoliday - pendingPaidHoliday

  return { remainingPaidHoliday, remainingAfterPending }
}

export function isPaidHolidayLeaveType(leaveType: string | null | undefined): boolean {
  return leaveType == null || leaveType === 'paid_holiday'
}
