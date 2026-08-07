import { formatLocalDateString, parseLocalDate } from '@/lib/timesheetUtils'
import type { TimesheetStatus } from '@/lib/timesheetTypes'

export type WorkerHomeStatusTone = 'green' | 'amber' | 'red'

export type WorkerHomeVehicleCheckStatusInput = {
  /** Local calendar date YYYY-MM-DD (Worker device today). */
  todayLocalDate: string
  /**
   * Completed Vehicle Checks for this Worker, newest first.
   * Only status === 'Completed' rows should be passed.
   */
  completedChecks: Array<{
    inspectionDate: string
    signedAt: string | null
    inspectionCompletedAt: string | null
  }>
}

export type WorkerHomeVehicleCheckStatus = {
  tone: 'green' | 'red'
  title: string
  /** ISO timestamp or inspection date string for display, when known. */
  detailAt: string | null
  completedToday: boolean
}

export type WorkerHomeTimesheetStatusInput = {
  currentWeek: {
    status: TimesheetStatus | null
    submittedAt: string | null
    updatedAt: string | null
  } | null
  previousWeek: {
    status: TimesheetStatus | null
    submittedAt: string | null
    updatedAt: string | null
  } | null
}

export type WorkerHomeTimesheetStatus = {
  tone: WorkerHomeStatusTone
  title: string
  detailAt: string | null
}

/** Prefer completion timestamps; fall back to inspection_date (date-only). */
export function resolveVehicleCheckCompletionInstant(check: {
  inspectionDate: string
  signedAt: string | null
  inspectionCompletedAt: string | null
}): string {
  return (
    check.inspectionCompletedAt?.trim() ||
    check.signedAt?.trim() ||
    check.inspectionDate
  )
}

function localDateFromInstantOrDate(value: string): string {
  // Date-only YYYY-MM-DD — treat as local calendar day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return formatLocalDateString(date)
}

/**
 * Vehicle Check Home status:
 * - green: at least one Completed check whose completion day is today
 * - red: otherwise (show latest previous completion when available)
 */
export function resolveWorkerHomeVehicleCheckStatus(
  input: WorkerHomeVehicleCheckStatusInput,
): WorkerHomeVehicleCheckStatus {
  const { todayLocalDate, completedChecks } = input
  const latest = completedChecks[0] ?? null

  const completedToday = completedChecks.find((check) => {
    const instant = resolveVehicleCheckCompletionInstant(check)
    return localDateFromInstantOrDate(instant) === todayLocalDate
  })

  if (completedToday) {
    return {
      tone: 'green',
      title: 'Completed today',
      detailAt: resolveVehicleCheckCompletionInstant(completedToday),
      completedToday: true,
    }
  }

  return {
    tone: 'red',
    title: 'Not completed today',
    detailAt: latest ? resolveVehicleCheckCompletionInstant(latest) : null,
    completedToday: false,
  }
}

export function isTimesheetSubmittedOrApproved(
  status: TimesheetStatus | null | undefined,
): boolean {
  return status === 'Submitted' || status === 'Approved'
}

export function isTimesheetStillOpen(
  status: TimesheetStatus | null | undefined,
): boolean {
  return status === 'Draft' || status === 'Rejected'
}

/**
 * Timesheet Home status — mapped from existing timesheet statuses only.
 *
 * There is no dedicated timesheet “overdue deadline” in the codebase.
 * Derived mapping (does not invent a new submission deadline day):
 * - red: previous week exists and is still Draft/Rejected (past required week not submitted)
 * - green: current week is Submitted or Approved
 * - amber: current week still open / missing (in progress, not submitted)
 */
export function resolveWorkerHomeTimesheetStatus(
  input: WorkerHomeTimesheetStatusInput,
): WorkerHomeTimesheetStatus {
  const previous = input.previousWeek
  const current = input.currentWeek

  if (previous && isTimesheetStillOpen(previous.status)) {
    return {
      tone: 'red',
      title: 'Overdue',
      detailAt: previous.submittedAt ?? previous.updatedAt,
    }
  }

  if (current && isTimesheetSubmittedOrApproved(current.status)) {
    return {
      tone: 'green',
      title: 'Submitted',
      detailAt: current.submittedAt ?? current.updatedAt,
    }
  }

  return {
    tone: 'amber',
    title: 'In progress',
    detailAt: current?.submittedAt ?? current?.updatedAt ?? null,
  }
}

export function previousTimesheetWeekStart(currentWeekStart: string): string {
  const date = parseLocalDate(currentWeekStart)
  date.setDate(date.getDate() - 7)
  return formatLocalDateString(date)
}

export function formatWorkerHomeStatusDetail(
  detailAt: string | null,
): string | null {
  if (!detailAt) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(detailAt)) {
    const date = parseLocalDate(detailAt)
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date)
  }
  const date = new Date(detailAt)
  if (Number.isNaN(date.getTime())) return null
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${datePart} · ${timePart}`
}
