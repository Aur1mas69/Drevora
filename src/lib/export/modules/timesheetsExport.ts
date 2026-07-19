import { MAX_ZIP_PDFS } from '@/lib/export/constants'
import { downloadBlob } from '@/lib/export/downloadBlob'
import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import type { ExportMeta } from '@/lib/export/exportMeta'
import {
  EXPORT_ERROR_EMPTY,
  EXPORT_ERROR_ZIP_TOO_LARGE,
  ExportUserError,
} from '@/lib/export/exportErrors'
import { fetchAllFilteredRows } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName } from '@/lib/export/fileNames'
import type { Timesheet, TimesheetListItem, TimesheetsQuery } from '@/lib/timesheetTypes'
import {
  formatHours,
  formatSubmittedAtDisplay,
  getStatusLabel,
} from '@/lib/timesheetUtils'
import { fetchTimesheetById, fetchTimesheetsPage } from '@/services/timesheetsService'

function weekEndFromStart(weekStart: string): string {
  const date = new Date(`${weekStart}T12:00:00`)
  date.setDate(date.getDate() + 6)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export async function exportTimesheetsExcel(
  query: Omit<TimesheetsQuery, 'page' | 'pageSize'>,
  _meta: ExportMeta,
): Promise<void> {
  const rows = await fetchAllFilteredRows<TimesheetListItem, typeof query>({
    baseQuery: query,
    fetchPage: async (pageQuery) => {
      const result = await fetchTimesheetsPage(pageQuery)
      return {
        items: result.items,
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
  })

  await downloadExcelWorkbook(
    [
      {
        name: 'Timesheets',
        columns: [
          { header: 'Week', key: 'week', width: 12 },
          { header: 'Week Start', key: 'weekStart', width: 14 },
          { header: 'Week End', key: 'weekEnd', width: 14 },
          { header: 'Worker', key: 'worker', width: 22 },
          { header: 'Employment Type', key: 'role', width: 16 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Worked', key: 'worked', width: 10 },
          { header: 'OT', key: 'ot', width: 10 },
          { header: 'Additional Hours', key: 'additional', width: 14 },
          { header: 'Total', key: 'total', width: 10 },
          { header: 'Submitted At', key: 'submittedAt', width: 18 },
          { header: 'Approved At', key: 'approvedAt', width: 18 },
          { header: 'Rejected At', key: 'rejectedAt', width: 18 },
          { header: 'Notes', key: 'notes', width: 28, wrap: true },
        ],
        rows: rows.map((row) => ({
          week: row.weekNumber,
          weekStart: row.weekStart,
          weekEnd: weekEndFromStart(row.weekStart),
          worker: excelEmpty(row.driverName),
          role: excelEmpty(row.driverRole),
          status: getStatusLabel(row.status),
          worked: formatHours(row.workedHours),
          ot: formatHours(row.overtimeHours),
          additional: formatHours(row.additionalHours),
          total: formatHours(row.totalHours),
          submittedAt: formatSubmittedAtDisplay(row.submittedAt, row.status),
          approvedAt:
            row.approvedAt && row.status === 'Approved'
              ? formatSubmittedAtDisplay(row.approvedAt, 'Approved')
              : '—',
          rejectedAt:
            row.rejectedAt && row.status === 'Rejected'
              ? formatSubmittedAtDisplay(row.rejectedAt, 'Rejected')
              : '—',
          notes: excelEmpty(row.notes),
        })),
      },
    ],
    buildExportFileName({
      module: 'Timesheets',
      parts: [query.weekStart, 'week'],
      extension: 'xlsx',
    }),
  )
}

export async function downloadTimesheetPdf(timesheet: Timesheet): Promise<void> {
  const {
    formatSingleTimesheetPdfFileName,
    generateSingleTimesheetPdfBlob,
  } = await import('@/lib/timesheetPdfExport')
  const blob = generateSingleTimesheetPdfBlob(timesheet)
  downloadBlob(blob, formatSingleTimesheetPdfFileName(timesheet))
}

export async function downloadTimesheetPdfById(id: string): Promise<void> {
  const timesheet = await fetchTimesheetById(id)
  await downloadTimesheetPdf(timesheet)
}

export async function exportSelectedTimesheetsPdfZip(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }
  if (ids.length > MAX_ZIP_PDFS) {
    throw new ExportUserError(EXPORT_ERROR_ZIP_TOO_LARGE)
  }
  const timesheets = await Promise.all(ids.map((id) => fetchTimesheetById(id)))
  const { exportTimesheetsToPdf } = await import('@/lib/timesheetPdfExport')
  await exportTimesheetsToPdf(timesheets)
}
