import type { EffectiveTimesheetSettings } from '@/lib/workerTimesheetSettingsTypes'

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

/** Short mobile summary for the Worker Settings Timesheet card. */
export function formatWorkerTimesheetSettingsSummary(
  effective: EffectiveTimesheetSettings,
): string {
  const sourceLabel = effective.hasWorkerOverride
    ? 'Personal settings'
    : 'Company defaults'

  if (effective.overtimeMode === 'Manual') {
    return `Manual · ${sourceLabel}`
  }

  if (effective.overtimeCalculationMethod === 'daily') {
    return `Automatic · Daily OT after ${formatHours(effective.overtimeAfterHours)}h`
  }

  if (effective.overtimeCalculationMethod === 'weekly') {
    return `Automatic · Weekly OT after ${formatHours(effective.weeklyOvertimeAfterHours)}h`
  }

  return `Automatic · ${sourceLabel}`
}
