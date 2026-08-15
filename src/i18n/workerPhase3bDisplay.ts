import type { TFunction } from 'i18next'
import type { ContactCategory } from '@/lib/contactTypes'
import type { DriverReportPriority, DriverReportType } from '@/lib/driverReportTypes'
import type { HolidayDayPortion, HolidayRequestStatus } from '@/lib/holidayRequestTypes'
import { holidayPortionCode, normalizeHolidayDayPortion } from '@/lib/timesheetHoliday'
import type { WorkerSubmissionDocumentType, WorkerSubmissionReviewStatus } from '@/lib/workerDocumentSubmissionTypes'
import {
  WORKER_PRIVATE_NOTE_CONTENT_MAX,
  WORKER_PRIVATE_NOTE_TITLE_MAX,
} from '@/lib/workerPrivateNotes'
import { workerIntlLocale } from '@/i18n/workerTimesheetDisplay'

export function formatWorkerMonthYear(date: Date, language: string | undefined): string {
  return new Intl.DateTimeFormat(workerIntlLocale(language), {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function getWorkerWeekdayLabels(
  weekStarts: 'monday' | 'sunday',
  language: string | undefined,
): string[] {
  const formatter = new Intl.DateTimeFormat(workerIntlLocale(language), {
    weekday: 'short',
  })
  const sunday = new Date(2024, 0, 7)
  const start = weekStarts === 'sunday' ? 0 : 1
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday)
    date.setDate(sunday.getDate() + ((start + index) % 7))
    return formatter.format(date)
  })
}

export function holidayStatusI18nKey(
  status: HolidayRequestStatus,
):
  | 'holidays.statusApproved'
  | 'holidays.statusPending'
  | 'holidays.statusDeclined'
  | 'holidays.statusCancelled' {
  switch (status) {
    case 'Approved':
      return 'holidays.statusApproved'
    case 'Pending':
      return 'holidays.statusPending'
    case 'Rejected':
      return 'holidays.statusDeclined'
    case 'Cancelled':
      return 'holidays.statusCancelled'
  }
}

export function formatWorkerHolidayDays(count: number, t: TFunction): string {
  const rounded = Math.round(count * 10) / 10
  return rounded === 1
    ? t('holidays.dayOne', { count: rounded })
    : t('holidays.dayOther', { count: rounded })
}

export function holidayPortionLabel(
  portion: HolidayDayPortion,
  t: TFunction,
  short = false,
): string {
  if (portion === 'first_half') {
    return t(short ? 'holidays.portionAmShort' : 'holidays.portionAm')
  }
  if (portion === 'second_half') {
    return t(short ? 'holidays.portionPmShort' : 'holidays.portionPm')
  }
  return t(short ? 'holidays.portionFullShort' : 'holidays.portionFull')
}

export function formatWorkerHolidayPortionSummary(
  input: {
    startDate: string
    endDate: string
    startDayPortion?: HolidayDayPortion | null
    endDayPortion?: HolidayDayPortion | null
  },
  t: TFunction,
): string {
  const start = normalizeHolidayDayPortion(input.startDayPortion)
  const end =
    input.startDate === input.endDate
      ? start
      : normalizeHolidayDayPortion(input.endDayPortion)
  if (input.startDate === input.endDate) {
    return t('holidays.portionSummarySingle', {
      code: holidayPortionCode(start),
      label: holidayPortionLabel(start, t, true),
    })
  }
  if (start === 'full' && end === 'full') {
    return t('holidays.portionRangeFull')
  }
  return t('holidays.portionSummaryRange', {
    startCode: holidayPortionCode(start),
    endCode: holidayPortionCode(end),
  })
}

export function translateHolidayServiceError(
  message: string,
  t: TFunction,
): string {
  if (message === 'End date must be on or after start date.') {
    return t('holidays.endBeforeStart')
  }
  if (message === 'Worker not found for this company.') {
    return t('holidays.workerNotFound')
  }
  return message
}

export function driverReportTypeI18nKey(
  type: string,
):
  | 'reports.typeVehicleIssue'
  | 'reports.typeDamage'
  | 'reports.typeLoad'
  | 'reports.typeSite'
  | 'reports.typeHealthSafety'
  | 'reports.typeDelay'
  | 'reports.typeOther' {
  const map: Record<
    DriverReportType,
    | 'reports.typeVehicleIssue'
    | 'reports.typeDamage'
    | 'reports.typeLoad'
    | 'reports.typeSite'
    | 'reports.typeHealthSafety'
    | 'reports.typeDelay'
    | 'reports.typeOther'
  > = {
    'Vehicle issue': 'reports.typeVehicleIssue',
    Damage: 'reports.typeDamage',
    'Load / cargo issue': 'reports.typeLoad',
    'Site / customer issue': 'reports.typeSite',
    'Health & safety': 'reports.typeHealthSafety',
    'Delay / operational issue': 'reports.typeDelay',
    Other: 'reports.typeOther',
  }
  return map[type as DriverReportType] ?? 'reports.typeOther'
}

export function driverReportPriorityI18nKey(
  priority: DriverReportPriority,
):
  | 'reports.priorityLow'
  | 'reports.priorityMedium'
  | 'reports.priorityHigh'
  | 'reports.priorityCritical' {
  switch (priority) {
    case 'Low':
      return 'reports.priorityLow'
    case 'Medium':
      return 'reports.priorityMedium'
    case 'High':
      return 'reports.priorityHigh'
    case 'Critical':
      return 'reports.priorityCritical'
  }
}

export function documentTypeI18nKey(
  type: WorkerSubmissionDocumentType,
):
  | 'documents.typeCmr'
  | 'documents.typePod'
  | 'documents.typeReceipt'
  | 'documents.typeVehicleLoad'
  | 'documents.typeOther' {
  switch (type) {
    case 'CMR':
      return 'documents.typeCmr'
    case 'POD / Delivery Note':
      return 'documents.typePod'
    case 'Receipt':
      return 'documents.typeReceipt'
    case 'Vehicle / Load Document':
      return 'documents.typeVehicleLoad'
    case 'Other':
      return 'documents.typeOther'
  }
}

export function documentReviewI18nKey(
  status: WorkerSubmissionReviewStatus,
): 'documents.statusPending' | 'documents.statusReviewed' | 'documents.statusRejected' {
  switch (status) {
    case 'pending_review':
      return 'documents.statusPending'
    case 'reviewed':
      return 'documents.statusReviewed'
    case 'rejected':
      return 'documents.statusRejected'
  }
}

export function contactCategoryI18nKey(
  category: ContactCategory,
):
  | 'contacts.categoryCustomer'
  | 'contacts.categorySupplier'
  | 'contacts.categoryGarage'
  | 'contacts.categorySite'
  | 'contacts.categoryInsurance'
  | 'contacts.categoryAccountant'
  | 'contacts.categoryEmergency'
  | 'contacts.categoryWorker'
  | 'contacts.categoryOther' {
  switch (category) {
    case 'customer':
      return 'contacts.categoryCustomer'
    case 'supplier':
      return 'contacts.categorySupplier'
    case 'garage_workshop':
      return 'contacts.categoryGarage'
    case 'site_plant':
      return 'contacts.categorySite'
    case 'insurance':
      return 'contacts.categoryInsurance'
    case 'accountant':
      return 'contacts.categoryAccountant'
    case 'emergency':
      return 'contacts.categoryEmergency'
    case 'worker':
      return 'contacts.categoryWorker'
    case 'other':
    default:
      return 'contacts.categoryOther'
  }
}

export function translateWorkerSubmissionFileError(
  error: string | null,
  t: TFunction,
): string | null {
  if (!error) return null
  if (error === 'Attach at least one PDF or image file.') return t('documents.needFile')
  const maxMatch = error.match(/^You can attach at most (\d+) files\.$/)
  if (maxMatch) return t('documents.maxFiles', { max: maxMatch[1] })
  const tooLarge = error.match(/^"(.+)" must be 10 MB or smaller\.$/)
  if (tooLarge) return t('documents.fileTooLarge', { name: tooLarge[1] })
  const badType = error.match(
    /^"(.+)" is not a supported file type\. Use PDF, JPG, PNG or WEBP\.$/,
  )
  if (badType) return t('documents.fileType', { name: badType[1] })
  const already = error.match(/^"(.+)" is already selected\.$/)
  if (already) return t('documents.alreadySelected', { name: already[1] })
  return error
}

export function translateWorkerNoteValidation(
  error: string | null,
  t: TFunction,
): string | null {
  if (!error) return null
  if (error === 'Enter a title.') return t('notes.enterTitle')
  if (error === 'Enter a note.') return t('notes.enterNote')
  if (error === `Title must be ${WORKER_PRIVATE_NOTE_TITLE_MAX} characters or fewer.`) {
    return t('notes.titleTooLong', { max: WORKER_PRIVATE_NOTE_TITLE_MAX })
  }
  if (error === `Note must be ${WORKER_PRIVATE_NOTE_CONTENT_MAX} characters or fewer.`) {
    return t('notes.noteTooLong', { max: WORKER_PRIVATE_NOTE_CONTENT_MAX })
  }
  return error
}

export function translateDriverReportFileError(
  error: string | null,
  t: TFunction,
): string | null {
  if (!error) return null
  if (error === 'File must be 10 MB or smaller.') return t('reports.fileTooLarge')
  if (error === 'Only PDF, JPG, PNG and WEBP files are allowed.') return t('reports.fileType')
  return error
}
