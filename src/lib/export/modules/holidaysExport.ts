import { MAX_ZIP_PDFS } from '@/lib/export/constants'
import { downloadBlob } from '@/lib/export/downloadBlob'
import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import type { ExportMeta } from '@/lib/export/exportMeta'
import {
  EXPORT_ERROR_EMPTY,
  EXPORT_ERROR_TOO_LARGE,
  EXPORT_ERROR_ZIP_TOO_LARGE,
  ExportUserError,
} from '@/lib/export/exportErrors'
import { fetchAllFilteredRows } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName } from '@/lib/export/fileNames'
import {
  addBrandedFooters,
  createBrandedPdf,
  pdfText,
  renderBrandedHeader,
  renderKeyValueSection,
  renderSectionTitle,
} from '@/lib/export/pdfDocument'
import { downloadPdfEntriesOrSingle } from '@/lib/export/zipPdfs'
import type { HolidayRequest, HolidayRequestsQuery } from '@/lib/holidayRequestTypes'
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import { fetchHolidayRequests } from '@/services/holidayRequestsService'

function leaveTypeLabel(request: HolidayRequest): string {
  if (request.leaveType === 'unpaid_leave') return 'Unpaid'
  if (request.leaveType === 'bank_holiday') return 'Bank holiday'
  return request.isPaidLeave ? 'Paid' : 'Unpaid'
}

function holidayRequestPdfFileName(request: HolidayRequest): string {
  return buildExportFileName({
    module: 'Holiday-Request',
    parts: [request.workerName, request.startDate],
    extension: 'pdf',
  })
}

export async function exportHolidayRequestsExcel(
  query: Omit<HolidayRequestsQuery, 'page' | 'pageSize'>,
  _meta: ExportMeta,
): Promise<void> {
  const rows = await fetchAllFilteredRows<HolidayRequest, typeof query>({
    baseQuery: query,
    fetchPage: async (pageQuery) => {
      const result = await fetchHolidayRequests(pageQuery)
      return {
        items: result.items,
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
  })

  const year = new Date().getFullYear().toString()
  await downloadExcelWorkbook(
    [
      {
        name: 'Holiday Requests',
        columns: [
          { header: 'Worker', key: 'worker', width: 22 },
          { header: 'Start Date', key: 'startDate', width: 14 },
          { header: 'End Date', key: 'endDate', width: 14 },
          { header: 'Number of Days', key: 'days', width: 14 },
          { header: 'Paid / Unpaid', key: 'paid', width: 14 },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Requested At', key: 'requestedAt', width: 18 },
          { header: 'Notes', key: 'notes', width: 28, wrap: true },
          { header: 'Manager Note', key: 'managerNote', width: 28, wrap: true },
        ],
        rows: rows.map((row) => ({
          worker: excelEmpty(row.workerName),
          startDate: formatDateFromIso(row.startDate),
          endDate: formatDateFromIso(row.endDate),
          days: row.holidayDaysDeducted || row.totalDays,
          paid: leaveTypeLabel(row),
          status: row.status,
          requestedAt: formatDateTimeFromIso(row.createdAt),
          notes: excelEmpty(row.reason),
          managerNote: excelEmpty(row.managerNote),
        })),
      },
    ],
    buildExportFileName({
      module: 'Holiday-Requests',
      parts: [query.dateFrom, query.dateTo, year],
      extension: 'xlsx',
    }),
  )
}

export async function generateHolidayRequestPdfBlob(
  request: HolidayRequest,
  meta: ExportMeta,
): Promise<Blob> {
  const doc = createBrandedPdf()
  let y = await renderBrandedHeader(doc, {
    ...meta,
    documentTitle: 'Holiday Request',
  })

  y = renderKeyValueSection(doc, y, [
    { label: 'Worker', value: pdfText(request.workerName) },
    { label: 'Status', value: pdfText(request.status) },
    { label: 'Start date', value: formatDateFromIso(request.startDate) },
    { label: 'End date', value: formatDateFromIso(request.endDate) },
    { label: 'Leave days', value: String(request.holidayDaysDeducted || request.totalDays) },
    { label: 'Paid / Unpaid', value: leaveTypeLabel(request) },
    { label: 'Requested at', value: formatDateTimeFromIso(request.createdAt) },
    { label: 'Role', value: pdfText(request.workerRole) },
  ])

  y = renderSectionTitle(doc, 'Request notes', y + 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const notes = doc.splitTextToSize(pdfText(request.reason), 186)
  doc.text(notes, 12, y)
  y += notes.length * 4.2 + 6

  y = renderSectionTitle(doc, 'Manager decision', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const manager = doc.splitTextToSize(pdfText(request.managerNote), 186)
  doc.text(manager, 12, y)

  addBrandedFooters(doc, meta)
  return doc.output('blob')
}

export async function downloadHolidayRequestPdf(
  request: HolidayRequest,
  meta: ExportMeta,
): Promise<void> {
  const blob = await generateHolidayRequestPdfBlob(request, meta)
  downloadBlob(blob, holidayRequestPdfFileName(request))
}

/** Export filtered holiday requests as individual PDFs (1 → PDF, many → ZIP). */
export async function exportHolidayRequestsFilteredPdfs(
  query: Omit<HolidayRequestsQuery, 'page' | 'pageSize'>,
  meta: ExportMeta,
): Promise<void> {
  let rows: HolidayRequest[]
  try {
    rows = await fetchAllFilteredRows({
      baseQuery: query,
      fetchPage: async (pageQuery) => {
        const result = await fetchHolidayRequests(pageQuery)
        return {
          items: result.items,
          totalCount: result.totalCount,
          page: result.page,
          pageSize: result.pageSize,
        }
      },
      maxRows: MAX_ZIP_PDFS,
    })
  } catch (error) {
    if (error instanceof ExportUserError && error.message === EXPORT_ERROR_TOO_LARGE) {
      throw new ExportUserError(EXPORT_ERROR_ZIP_TOO_LARGE)
    }
    throw error
  }

  const entries: Array<{ fileName: string; blob: Blob }> = []
  for (const request of rows) {
    try {
      const blob = await generateHolidayRequestPdfBlob(request, meta)
      entries.push({ fileName: holidayRequestPdfFileName(request), blob })
    } catch {
      // Skip failed rows.
    }
  }

  if (entries.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }

  await downloadPdfEntriesOrSingle(
    entries,
    buildExportFileName({
      module: 'Holiday-Requests',
      parts: [query.dateFrom, query.dateTo],
      extension: 'zip',
    }),
  )
}
