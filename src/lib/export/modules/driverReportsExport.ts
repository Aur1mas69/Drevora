import { downloadCsvFile } from '@/lib/export/csvExport'
import { downloadBlob } from '@/lib/export/downloadBlob'
import {
  downloadFileFromSignedUrl,
  downloadZipArchive,
  fetchBlobFromUrl,
  resolveDownloadFileName,
  type ZipFileEntry,
} from '@/lib/export/downloadFiles'
import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import { ExportUserError } from '@/lib/export/exportErrors'
import type { ExportMeta } from '@/lib/export/exportMeta'
import { assertExportNotEmpty } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName, sanitizeFileNamePart } from '@/lib/export/fileNames'
import {
  addBrandedFooters,
  createBrandedPdf,
  fetchImageDataUrlForPdf,
  pdfText,
  renderBrandedHeader,
  renderKeyValueSection,
  renderSectionTitle,
} from '@/lib/export/pdfDocument'
import { formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import { getDriverReportFileDisplayName } from '@/lib/driverReportFileStorage'
import type { DriverReport } from '@/lib/driverReportTypes'
import { hasDriverReportAttachment } from '@/lib/driverReportUtils'
import {
  DriverReportFileStorageError,
  getDriverReportFileSignedUrl,
} from '@/services/driverReportFileStorageService'

function todayStamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getReportAttachmentPath(report: DriverReport): string | null {
  const path = report.attachmentPath?.trim() || report.attachmentUrl?.trim() || null
  return path || null
}

export async function exportDriverReportsExcel(
  filteredReports: DriverReport[],
  meta: ExportMeta,
  filterParts?: Array<string | null | undefined>,
): Promise<void> {
  void meta
  const rows = assertExportNotEmpty(filteredReports)

  await downloadExcelWorkbook(
    [
      {
        name: 'Driver Reports',
        columns: [
          { header: 'Date / Time', key: 'when', width: 18 },
          { header: 'Worker', key: 'worker', width: 20 },
          { header: 'Vehicle', key: 'vehicle', width: 18 },
          { header: 'Category', key: 'category', width: 18 },
          { header: 'Title', key: 'title', width: 28, wrap: true },
          { header: 'Status', key: 'status', width: 12 },
          { header: 'Priority', key: 'priority', width: 12 },
          { header: 'Location', key: 'location', width: 18 },
          { header: 'Created At', key: 'createdAt', width: 18 },
          { header: 'Updated At', key: 'updatedAt', width: 18 },
        ],
        rows: rows.map((row) => ({
          when: row.issueDatetime
            ? formatDateTimeFromIso(row.issueDatetime)
            : formatDateTimeFromIso(row.createdAt),
          worker: excelEmpty(row.workerName),
          vehicle: excelEmpty(row.vehicleLabel),
          category: excelEmpty(row.reportType),
          title: excelEmpty(row.title),
          status: row.status,
          priority: row.priority,
          location: excelEmpty(row.location),
          createdAt: formatDateTimeFromIso(row.createdAt),
          updatedAt: formatDateTimeFromIso(row.updatedAt),
        })),
      },
    ],
    buildExportFileName({
      module: 'Driver-Reports',
      parts: filterParts,
      extension: 'xlsx',
    }),
  )
}

/** Filtered Driver Reports metadata as a real CSV (no binary / paths / URLs). */
export function exportDriverReportsCsv(reports: DriverReport[]): void {
  const rows = assertExportNotEmpty(reports)

  downloadCsvFile(
    [
      'Date / Time',
      'Worker',
      'Vehicle',
      'Category',
      'Title',
      'Status',
      'Priority',
      'Location',
      'Created At',
      'Updated At',
      'Has Attachment',
    ],
    rows.map((row) => [
      row.issueDatetime
        ? formatDateTimeFromIso(row.issueDatetime)
        : formatDateTimeFromIso(row.createdAt),
      row.workerName ?? '',
      row.vehicleLabel ?? '',
      row.reportType ?? '',
      row.title ?? '',
      row.status,
      row.priority,
      row.location ?? '',
      formatDateTimeFromIso(row.createdAt),
      formatDateTimeFromIso(row.updatedAt),
      hasDriverReportAttachment(row) ? 'Yes' : 'No',
    ]),
    buildExportFileName({
      module: 'Driver-Reports',
      parts: [todayStamp()],
      extension: 'csv',
    }),
  )
}

export function countDownloadableDriverReportFiles(reports: DriverReport[]): number {
  return reports.filter((report) => hasDriverReportAttachment(report)).length
}

/** Download one Driver Report attachment as the original private file. */
export async function downloadDriverReportOriginalFile(
  report: DriverReport,
): Promise<void> {
  const path = getReportAttachmentPath(report)
  if (!path) {
    throw new ExportUserError('No file is available to download.')
  }

  const fileName = resolveDownloadFileName(getDriverReportFileDisplayName(path), null)

  try {
    const url = await getDriverReportFileSignedUrl(path)
    if (!url) {
      throw new ExportUserError('Unable to download file.')
    }
    await downloadFileFromSignedUrl(url, fileName)
  } catch (error) {
    if (error instanceof ExportUserError) throw error
    if (error instanceof DriverReportFileStorageError) {
      throw new ExportUserError(error.message)
    }
    throw new ExportUserError('Unable to download file.')
  }
}

/** Bulk ZIP of all available attachments from the filtered Driver Reports set. */
export async function downloadFilteredDriverReportsZip(
  reports: DriverReport[],
): Promise<void> {
  const entries: ZipFileEntry[] = []

  for (const report of reports) {
    const path = getReportAttachmentPath(report)
    if (!path) continue

    try {
      const url = await getDriverReportFileSignedUrl(path)
      if (!url) {
        throw new ExportUserError(
          'One or more files could not be downloaded. The archive was not created.',
        )
      }
      const blob = await fetchBlobFromUrl(url)
      const fileName = resolveDownloadFileName(getDriverReportFileDisplayName(path), null)
      const prefix = sanitizeFileNamePart(
        [report.workerName || 'Worker', report.title || report.reportType || 'Report'].join(
          '_',
        ),
        50,
      )
      entries.push({ fileName: `${prefix}_${fileName}`, blob })
    } catch (error) {
      if (error instanceof ExportUserError) throw error
      throw new ExportUserError(
        'One or more files could not be downloaded. The archive was not created.',
      )
    }
  }

  if (entries.length === 0) {
    throw new ExportUserError('No files available to download.')
  }

  await downloadZipArchive(
    entries,
    buildExportFileName({
      module: 'Driver-Reports',
      parts: [todayStamp()],
      extension: 'zip',
    }),
  )
}

export async function downloadDriverReportPdf(
  report: DriverReport,
  meta: ExportMeta,
): Promise<void> {
  const doc = createBrandedPdf()
  let y = await renderBrandedHeader(doc, {
    ...meta,
    documentTitle: 'Driver Report',
  })

  y = renderKeyValueSection(doc, y, [
    { label: 'Category', value: pdfText(report.reportType) },
    { label: 'Status', value: pdfText(report.status) },
    { label: 'Priority', value: pdfText(report.priority) },
    { label: 'Worker', value: pdfText(report.workerName) },
    { label: 'Vehicle', value: pdfText(report.vehicleLabel) },
    {
      label: 'Report date / time',
      value: report.issueDatetime
        ? formatDateTimeFromIso(report.issueDatetime)
        : formatDateTimeFromIso(report.createdAt),
    },
    { label: 'Location', value: pdfText(report.location) },
    { label: 'Created at', value: formatDateTimeFromIso(report.createdAt) },
  ])

  y = renderSectionTitle(doc, 'Title', y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const titleLines = doc.splitTextToSize(pdfText(report.title), 186)
  doc.text(titleLines, 12, y)
  y += titleLines.length * 4.5 + 4

  y = renderSectionTitle(doc, 'Description', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const description = doc.splitTextToSize(pdfText(report.description), 186)
  doc.text(description, 12, y)
  y += description.length * 4.2 + 4

  y = renderSectionTitle(doc, 'Office response', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const office = doc.splitTextToSize(pdfText(report.officeNotes), 186)
  doc.text(office, 12, y)
  y += office.length * 4.2 + 6

  const attachmentRef = report.attachmentPath || report.attachmentUrl
  if (attachmentRef?.trim()) {
    y = renderSectionTitle(doc, 'Attachment', y)
    try {
      const signed = await getDriverReportFileSignedUrl(attachmentRef)
      const dataUrl = signed ? await fetchImageDataUrlForPdf(signed) : null
      if (dataUrl) {
        doc.addImage(dataUrl, 'JPEG', 12, y, 70, 50)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text('Image unavailable', 12, y)
      }
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Image unavailable', 12, y)
    }
  }

  addBrandedFooters(doc, meta)
  downloadBlob(
    doc.output('blob'),
    buildExportFileName({
      module: 'Driver-Report',
      parts: [
        report.vehicleLabel,
        (report.issueDatetime || report.createdAt).slice(0, 10),
      ],
      extension: 'pdf',
    }),
  )
}
