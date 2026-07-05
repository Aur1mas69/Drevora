import { getGlobalPaidBreaks, getSetting } from '@/lib/companySettingsGlobals'
import type { Timesheet, TimesheetEntryInput } from '@/lib/timesheetTypes'
import {
  applyViewModeEntryTotals,
  entryHasStartAndFinish,
  formatBreak,
  formatHours,
  formatHoursFromMinutes,
  formatSubmittedAtDisplay,
  formatTimeDisplay,
  getStatusLabel,
  parseLocalDate,
  prepareEntryInputs,
  summarizeTimesheetEntries,
} from '@/lib/timesheetUtils'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/** DREVORA Timesheet PDF export v2 — active export module for bulk Export button. */
export const TIMESHEET_PDF_EXPORT_VERSION = 'v2'

const PAGE_MARGIN = 12
const CONTENT_WIDTH = 210 - PAGE_MARGIN * 2
const FOOTER_Y = 287
const HEADER_HEIGHT = 34
const GAP_AFTER_METADATA = 7
const GAP_AFTER_SECTION_TITLE = 4
const GAP_AFTER_DAILY_TABLE = 6

const DREVORA_BLUE: [number, number, number] = [33, 142, 231]
const HEADER_NAVY: [number, number, number] = [11, 38, 70]
const NAVY: [number, number, number] = [17, 60, 105]
const LABEL: [number, number, number] = [61, 122, 156]
const BORDER: [number, number, number] = [211, 233, 252]
const LIGHT_BLUE: [number, number, number] = [232, 243, 254]
const SOFT_BLUE: [number, number, number] = [245, 250, 255]
const WHITE: [number, number, number] = [255, 255, 255]
const EMPTY = '—'

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

type SummaryTotals = ReturnType<typeof summarizeTimesheetEntries>

function sanitizeFileName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'export'
  )
}

export function formatSingleTimesheetPdfFileName(timesheet: Timesheet): string {
  return `DREVORA-timesheet-${sanitizeFileName(timesheet.driverName)}-week-${timesheet.weekNumber}.pdf`
}

function formatZipExportFileName(): string {
  const today = new Intl.DateTimeFormat('en-CA').format(new Date())
  return `DREVORA-timesheets-export-${today}.zip`
}

export function buildUniquePdfFileNames(timesheets: Timesheet[]): string[] {
  const used = new Map<string, number>()

  return timesheets.map((timesheet) => {
    const stem = `DREVORA-timesheet-${sanitizeFileName(timesheet.driverName)}-week-${timesheet.weekNumber}`
    const count = used.get(stem) ?? 0
    used.set(stem, count + 1)

    if (count === 0) {
      return `${stem}.pdf`
    }

    return `${stem}-${count}.pdf`
  })
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.click()
  URL.revokeObjectURL(url)
}

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function formatPdfDayName(dayDate: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(parseLocalDate(dayDate))
}

function formatPdfDate(dayDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(parseLocalDate(dayDate))
}

function formatVehicleLabel(timesheet: Timesheet): string {
  const parts: string[] = []

  if (timesheet.vehicleRegistration && timesheet.vehicleRegistration !== '—') {
    parts.push(timesheet.vehicleRegistration)
  }

  if (timesheet.fleetNo && timesheet.fleetNo !== '—') {
    parts.push(`Fleet ${timesheet.fleetNo}`)
  }

  return parts.length > 0 ? parts.join(' · ') : EMPTY
}

function buildViewModeEntries(timesheet: Timesheet) {
  const defaultBreakMinutes = getSetting('defaultBreakMinutes') ?? 30

  return applyViewModeEntryTotals(
    prepareEntryInputs(timesheet.weekStart, timesheet.entries, defaultBreakMinutes),
    { paidBreaks: getGlobalPaidBreaks() },
  )
}

function buildSummary(timesheet: Timesheet): SummaryTotals {
  const entries = buildViewModeEntries(timesheet)

  return summarizeTimesheetEntries(
    entries.map((entry) => ({
      dayDate: entry.dayDate,
      startTime: entry.startTime,
      breakMinutes: entry.breakMinutes,
      finishTime: entry.finishTime,
      totalMinutes: entry.totalMinutes,
      overtimeMinutes: entry.overtimeMinutes,
      additionalHours: entry.additionalHours,
    })),
  )
}

function formatPdfDailyRow(entry: TimesheetEntryInput): string[] {
  const day = formatPdfDayName(entry.dayDate)
  const date = formatPdfDate(entry.dayDate)

  if (!entryHasStartAndFinish(entry)) {
    return [day, date, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]
  }

  return [
    day,
    date,
    formatTimeDisplay(entry.startTime),
    formatBreak(entry.breakMinutes),
    formatTimeDisplay(entry.finishTime),
    formatHoursFromMinutes(entry.totalMinutes),
    formatHoursFromMinutes(entry.overtimeMinutes),
    entry.additionalHours > 0 ? formatHours(entry.additionalHours) : EMPTY,
    entry.dailyComment.trim() || EMPTY,
  ]
}

function drawStatusBadge(
  doc: jsPDF,
  x: number,
  y: number,
  status: Timesheet['status'],
): void {
  const label = getStatusLabel(status)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const badgeWidth = doc.getTextWidth(label) + 8

  doc.setFillColor(...DREVORA_BLUE)
  doc.roundedRect(x - badgeWidth, y, badgeWidth, 6, 1.5, 1.5, 'F')
  doc.setTextColor(...WHITE)
  doc.text(label, x - badgeWidth / 2, y + 4.2, { align: 'center' })
}

function renderBrandedHeader(doc: jsPDF, timesheet: Timesheet): number {
  doc.setFillColor(...HEADER_NAVY)
  doc.rect(0, 0, 210, HEADER_HEIGHT, 'F')

  doc.setFillColor(...DREVORA_BLUE)
  doc.rect(0, HEADER_HEIGHT, 210, 1.2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...WHITE)
  doc.text('DREVORA', PAGE_MARGIN, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(190, 220, 245)
  doc.text('Fleet & Team Management', PAGE_MARGIN, 20)

  const rightX = 210 - PAGE_MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...WHITE)
  doc.text('Timesheet Report', rightX, 12, { align: 'right' })

  doc.setFontSize(10)
  doc.text(`Week ${timesheet.weekNumber}`, rightX, 18.5, { align: 'right' })

  drawStatusBadge(doc, rightX, 22.5, timesheet.status)

  return HEADER_HEIGHT + 6
}

function drawMetadataField(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  options?: { maxLines?: number; valueFontSize?: number },
): void {
  const padX = 3
  const maxLines = options?.maxLines ?? 2
  const valueFontSize = options?.valueFontSize ?? 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...LABEL)
  doc.text(label.toUpperCase(), x + padX, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(valueFontSize)
  doc.setTextColor(...NAVY)

  const lines = doc.splitTextToSize(value, Math.max(8, width - padX * 2))
  doc.text(lines.slice(0, maxLines), x + padX, y + 4.8)
}

function renderMetadataStrip(doc: jsPDF, timesheet: Timesheet, startY: number): number {
  const pad = 4
  const row1Height = 16
  const row2Height = 12
  const row3Height = 14
  const stripHeight = pad * 2 + row1Height + row2Height + row3Height

  doc.setFillColor(...SOFT_BLUE)
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.35)
  doc.roundedRect(PAGE_MARGIN, startY, CONTENT_WIDTH, stripHeight, 2.5, 2.5, 'FD')

  const col4Width = CONTENT_WIDTH / 4
  const col3Width = CONTENT_WIDTH / 3
  const row1Y = startY + pad + 5
  const row2Y = startY + pad + row1Height + 5
  const row3Y = startY + pad + row1Height + row2Height + 5

  const row1Fields = [
    { label: 'Generated', value: formatGeneratedAt() },
    { label: 'Worker', value: timesheet.driverName },
    { label: 'Role', value: timesheet.driverRole ?? EMPTY },
    { label: 'Week', value: timesheet.weekTitle },
  ]

  row1Fields.forEach((field, index) => {
    drawMetadataField(
      doc,
      PAGE_MARGIN + index * col4Width,
      row1Y,
      col4Width,
      field.label,
      field.value,
      { maxLines: 2, valueFontSize: index === 1 ? 7.5 : 8 },
    )
  })

  drawMetadataField(
    doc,
    PAGE_MARGIN,
    row2Y,
    CONTENT_WIDTH,
    'Date range',
    timesheet.weekRangeLabel,
    { maxLines: 2, valueFontSize: 8.5 },
  )

  const row3Fields = [
    {
      label: 'Submitted',
      value: formatSubmittedAtDisplay(timesheet.submittedAt, timesheet.status),
    },
    {
      label: 'Approved',
      value:
        timesheet.approvedAt && timesheet.status === 'Approved'
          ? formatSubmittedAtDisplay(timesheet.approvedAt, 'Approved')
          : EMPTY,
    },
    { label: 'Vehicle', value: formatVehicleLabel(timesheet) },
  ]

  row3Fields.forEach((field, index) => {
    drawMetadataField(
      doc,
      PAGE_MARGIN + index * col3Width,
      row3Y,
      col3Width,
      field.label,
      field.value,
      { maxLines: 2, valueFontSize: 7.5 },
    )
  })

  return startY + stripHeight
}

function renderSectionTitle(doc: jsPDF, title: string, startY: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...NAVY)
  doc.text(title, PAGE_MARGIN, startY)

  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(PAGE_MARGIN, startY + 1.5, PAGE_MARGIN + CONTENT_WIDTH, startY + 1.5)

  return startY + 1.5 + GAP_AFTER_SECTION_TITLE
}

function renderDailyTable(doc: jsPDF, timesheet: Timesheet, startY: number): number {
  const entries = buildViewModeEntries(timesheet)
  const tableBody = entries.map(formatPdfDailyRow)

  autoTable(doc, {
    startY,
    head: [['Day', 'Date', 'Start', 'Break', 'Finish', 'Worked', 'OT', 'Add. Hrs', 'Daily Note']],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: NAVY,
      overflow: 'linebreak',
      valign: 'top',
      minCellHeight: 6,
    },
    headStyles: {
      fillColor: DREVORA_BLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: SOFT_BLUE,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'left' },
      1: { cellWidth: 16, halign: 'left' },
      2: { cellWidth: 13, halign: 'center' },
      3: { cellWidth: 11, halign: 'center' },
      4: { cellWidth: 13, halign: 'center' },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 13, halign: 'center' },
      8: { cellWidth: CONTENT_WIDTH - 104, halign: 'left' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 20 },
    tableWidth: CONTENT_WIDTH,
  })

  return (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? startY
}

function drawMetricCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  highlighted: boolean,
): void {
  if (highlighted) {
    doc.setFillColor(...LIGHT_BLUE)
    doc.setDrawColor(...DREVORA_BLUE)
    doc.setLineWidth(0.55)
  } else {
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.25)
  }

  doc.roundedRect(x, y, width, height, 2, 2, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...LABEL)
  doc.text(label.toUpperCase(), x + 3.5, y + 5.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(highlighted ? 13 : 10.5)
  doc.setTextColor(...(highlighted ? DREVORA_BLUE : NAVY))
  doc.text(value, x + 3.5, y + height - 4)
}

function renderSummaryCards(doc: jsPDF, summary: SummaryTotals, startY: number): number {
  let y = renderSectionTitle(doc, 'Weekly Summary', startY)

  const gap = 3
  const smallCardW = (CONTENT_WIDTH - gap * 3) / 4
  const smallCardH = 17

  const metrics = [
    { label: 'Worked Hours', value: formatHours(summary.workedHours) },
    { label: 'Break', value: formatBreak(summary.breakMinutes) },
    { label: 'Overtime', value: formatHours(summary.overtimeHours) },
    { label: 'Additional Hours', value: formatHours(summary.additionalHours) },
  ]

  metrics.forEach((metric, index) => {
    const x = PAGE_MARGIN + index * (smallCardW + gap)
    drawMetricCard(doc, x, y, smallCardW, smallCardH, metric.label, metric.value, false)
  })

  y += smallCardH + gap + 1

  drawMetricCard(
    doc,
    PAGE_MARGIN,
    y,
    CONTENT_WIDTH,
    20,
    'Total Hours',
    formatHours(summary.totalHours),
    true,
  )

  return y + 24
}

function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.2)
    doc.line(PAGE_MARGIN, FOOTER_Y - 5, PAGE_MARGIN + CONTENT_WIDTH, FOOTER_Y - 5)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...LABEL)
    doc.text('Generated by DREVORA · Fleet & Team Management', PAGE_MARGIN, FOOTER_Y)
    doc.text(`Page ${page} of ${pageCount}`, PAGE_MARGIN + CONTENT_WIDTH, FOOTER_Y, {
      align: 'right',
    })
  }
}

function renderSingleTimesheetDocument(doc: jsPDF, timesheet: Timesheet): void {
  let y = renderBrandedHeader(doc, timesheet)
  y = renderMetadataStrip(doc, timesheet, y)
  y += GAP_AFTER_METADATA
  y = renderSectionTitle(doc, 'Daily Hours', y)
  y = renderDailyTable(doc, timesheet, y)
  renderSummaryCards(doc, buildSummary(timesheet), y + GAP_AFTER_DAILY_TABLE)
}

/** Builds one PDF document for a single timesheet (no other records included). */
export function generateSingleTimesheetPdf(timesheet: Timesheet): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  renderSingleTimesheetDocument(doc, timesheet)
  addFooters(doc)
  return doc
}

export function generateSingleTimesheetPdfBlob(timesheet: Timesheet): Blob {
  return generateSingleTimesheetPdf(timesheet).output('blob')
}

/**
 * Active export entry point — called from TimesheetsPage.handleBulkExport.
 * One timesheet → PDF download. Multiple → ZIP of separate PDFs.
 */
export async function exportTimesheetsToPdf(timesheets: Timesheet[]): Promise<void> {
  if (timesheets.length === 0) {
    throw new Error('Select at least one timesheet to export.')
  }

  console.info('DREVORA Timesheet PDF export v2')

  if (timesheets.length === 1) {
    const doc = generateSingleTimesheetPdf(timesheets[0])
    downloadBlob(doc.output('blob'), formatSingleTimesheetPdfFileName(timesheets[0]))
    return
  }

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const fileNames = buildUniquePdfFileNames(timesheets)

  for (let index = 0; index < timesheets.length; index += 1) {
    const doc = generateSingleTimesheetPdf(timesheets[index])
    zip.file(fileNames[index], doc.output('blob'))
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, formatZipExportFileName())
}
