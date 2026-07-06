import type { TimesheetKpiVisualStyle } from '@/components/timesheets/timesheetSummaryKpiStyles'
import { timesheetKpiVisualStyles } from '@/components/timesheets/timesheetSummaryKpiStyles'
import type { DriverReportKpiFilter } from '@/lib/driverReportTypes'

export const driverReportKpiVisualStyles = {
  new: timesheetKpiVisualStyles.submitted,
  in_progress: timesheetKpiVisualStyles.drafts,
  closed: timesheetKpiVisualStyles.approved,
  critical_high: timesheetKpiVisualStyles.rejected,
} satisfies Record<Exclude<DriverReportKpiFilter, 'all'>, TimesheetKpiVisualStyle>
