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
import { downloadPdfZip } from '@/lib/export/zipPdfs'
import {
  addBrandedFooters,
  createBrandedPdf,
  fetchImageDataUrlForPdf,
  pdfText,
  renderBrandedHeader,
  renderKeyValueSection,
  renderPdfTable,
  renderSectionTitle,
} from '@/lib/export/pdfDocument'
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import type { VehicleCheck, VehicleChecksQuery } from '@/lib/vehicleCheckTypes'
import {
  formatDefectReviewStatusLabel,
  formatVehicleCheckItemResultLabel,
  formatVehicleCheckResultLabel,
  resolveInspectionResult,
} from '@/lib/vehicleCheckUtils'
import { getVehicleCheckPhotoSignedUrl } from '@/services/vehicleCheckPhotoStorageService'
import { fetchVehicleCheckById, fetchVehicleChecks } from '@/services/vehicleChecksService'

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export async function exportVehicleChecksExcel(
  query: Omit<VehicleChecksQuery, 'page' | 'pageSize'>,
  _meta: ExportMeta,
): Promise<void> {
  const rows = await fetchAllFilteredRows<
    Awaited<ReturnType<typeof fetchVehicleChecks>>['items'][number],
    typeof query
  >({
    baseQuery: query,
    fetchPage: async (pageQuery) => {
      const result = await fetchVehicleChecks(pageQuery)
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
        name: 'Vehicle Checks',
        columns: [
          { header: 'Date', key: 'date', width: 14 },
          { header: 'Vehicle', key: 'vehicle', width: 16 },
          { header: 'Registration', key: 'registration', width: 14 },
          { header: 'Worker', key: 'worker', width: 20 },
          { header: 'Inspection Result', key: 'result', width: 16 },
          { header: 'Defect Count', key: 'defects', width: 12 },
          { header: 'Completion Status', key: 'status', width: 14 },
          { header: 'Manager Review Status', key: 'review', width: 18 },
          { header: 'Duration', key: 'duration', width: 12 },
          { header: 'Odometer', key: 'odometer', width: 12 },
          { header: 'Odometer Unit', key: 'odometerUnit', width: 12 },
          { header: 'Completed At', key: 'completedAt', width: 18 },
          { header: 'Reviewed By', key: 'reviewedBy', width: 18 },
          { header: 'Reviewed At', key: 'reviewedAt', width: 18 },
        ],
        rows: rows.map((row) => {
          const resultLabel = formatVehicleCheckResultLabel(
            resolveInspectionResult(row.overallResult, row.defectCount),
          )
          return {
            date: formatDateFromIso(row.inspectionDate),
            vehicle: excelEmpty(row.fleetNumber),
            registration: excelEmpty(row.vehicleRegistration),
            worker: excelEmpty(row.workerName),
            result: resultLabel,
            defects: row.defectCount,
            status: row.status,
            review: formatDefectReviewStatusLabel(row.defectReviewStatus, row.defectCount),
            duration: formatDuration(row.durationSeconds),
            odometer: row.odometer ?? '—',
            odometerUnit: row.odometerUnit,
            completedAt: row.inspectionCompletedAt
              ? formatDateTimeFromIso(row.inspectionCompletedAt)
              : '—',
            reviewedBy: excelEmpty(row.defectReviewedByName),
            reviewedAt: row.defectReviewedAt
              ? formatDateTimeFromIso(row.defectReviewedAt)
              : '—',
          }
        }),
      },
    ],
    buildExportFileName({
      module: 'Vehicle-Checks',
      parts: [query.dateFrom, query.dateTo],
      extension: 'xlsx',
    }),
  )
}

export async function generateVehicleCheckPdfBlob(
  check: VehicleCheck,
  meta: ExportMeta,
): Promise<Blob> {
  const doc = createBrandedPdf()
  let y = await renderBrandedHeader(doc, {
    ...meta,
    documentTitle: 'Vehicle Check',
  })

  const inspectionResult = formatVehicleCheckResultLabel(
    resolveInspectionResult(check.overallResult, check.defectCount),
  )

  y = renderKeyValueSection(doc, y, [
    { label: 'Vehicle', value: pdfText(check.vehicleRegistration) },
    { label: 'Fleet', value: pdfText(check.fleetNumber) },
    { label: 'Worker', value: pdfText(check.workerName) },
    { label: 'Inspection date', value: formatDateFromIso(check.inspectionDate) },
    { label: 'Duration', value: formatDuration(check.durationSeconds) },
    {
      label: 'Odometer',
      value:
        check.odometer == null ? '—' : `${check.odometer} ${check.odometerUnit}`,
    },
    { label: 'Inspection result', value: inspectionResult },
    { label: 'Completion status', value: pdfText(check.status) },
    {
      label: 'Manager review',
      value: formatDefectReviewStatusLabel(check.defectReviewStatus, check.defectCount),
    },
    { label: 'Reviewed by', value: pdfText(check.defectReviewedByName) },
    {
      label: 'Reviewed at',
      value: check.defectReviewedAt
        ? formatDateTimeFromIso(check.defectReviewedAt)
        : '—',
    },
    { label: 'Defect count', value: String(check.defectCount) },
  ])

  y = renderSectionTitle(doc, 'Checklist', y)
  y = renderPdfTable(
    doc,
    y,
    ['Item', 'Result', 'Notes'],
    check.items.map((item) => [
      `${item.category}: ${item.itemName}`,
      formatVehicleCheckItemResultLabel(item.result),
      pdfText(item.comment),
    ]),
  )

  if (check.notes?.trim()) {
    y = renderSectionTitle(doc, 'Overall notes', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notes = doc.splitTextToSize(check.notes.trim(), 186)
    doc.text(notes, 12, y)
    y += notes.length * 4.2 + 4
  }

  if (check.defectReviewNotes?.trim()) {
    y = renderSectionTitle(doc, 'Manager notes', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notes = doc.splitTextToSize(check.defectReviewNotes.trim(), 186)
    doc.text(notes, 12, y)
    y += notes.length * 4.2 + 4
  }

  const defectPhotos = check.items.filter(
    (item) => item.photoUrl?.trim() && item.result === 'Advisory',
  )

  if (defectPhotos.length > 0) {
    y = renderSectionTitle(doc, 'Defect photos', y)
    for (const item of defectPhotos) {
      if (y > 240) {
        doc.addPage()
        y = 16
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(item.itemName, 12, y)
      y += 4
      try {
        const signed = await getVehicleCheckPhotoSignedUrl(item.photoUrl!)
        const dataUrl = signed ? await fetchImageDataUrlForPdf(signed) : null
        if (dataUrl) {
          doc.addImage(dataUrl, 'JPEG', 12, y, 60, 45)
          y += 50
        } else {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.text('Image unavailable', 12, y)
          y += 6
        }
      } catch {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text('Image unavailable', 12, y)
        y += 6
      }
    }
  }

  if (check.signatureUrl?.trim()) {
    if (y > 230) {
      doc.addPage()
      y = 16
    }
    y = renderSectionTitle(doc, 'Worker signature', y)
    try {
      const signed = await getVehicleCheckPhotoSignedUrl(check.signatureUrl)
      const dataUrl = signed ? await fetchImageDataUrlForPdf(signed) : null
      if (dataUrl) {
        doc.addImage(dataUrl, 'PNG', 12, y, 70, 28)
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
  return doc.output('blob')
}

export function vehicleCheckPdfFileName(check: VehicleCheck): string {
  return buildExportFileName({
    module: 'Vehicle-Check',
    parts: [check.vehicleRegistration, check.inspectionDate],
    extension: 'pdf',
  })
}

export async function downloadVehicleCheckPdf(
  check: VehicleCheck,
  meta: ExportMeta,
): Promise<void> {
  const blob = await generateVehicleCheckPdfBlob(check, meta)
  downloadBlob(blob, vehicleCheckPdfFileName(check))
}

export async function downloadVehicleCheckPdfById(
  id: string,
  meta: ExportMeta,
): Promise<void> {
  const check = await fetchVehicleCheckById(id)
  if (!check) throw new ExportUserError(EXPORT_ERROR_EMPTY)
  await downloadVehicleCheckPdf(check, meta)
}

/** Export all filtered Vehicle Checks as individual PDFs in one ZIP (max 100). */
export async function exportVehicleChecksFilteredPdfs(
  query: Omit<VehicleChecksQuery, 'page' | 'pageSize'>,
  meta: ExportMeta,
): Promise<void> {
  let rows: Awaited<ReturnType<typeof fetchVehicleChecks>>['items']
  try {
    rows = await fetchAllFilteredRows({
      baseQuery: query,
      fetchPage: async (pageQuery) => {
        const result = await fetchVehicleChecks(pageQuery)
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

  for (const row of rows) {
    try {
      const check = await fetchVehicleCheckById(row.id)
      if (!check) continue
      const blob = await generateVehicleCheckPdfBlob(check, meta)
      entries.push({ fileName: vehicleCheckPdfFileName(check), blob })
    } catch {
      // Skip failed individual records; continue packaging the rest.
    }
  }

  if (entries.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }

  if (entries.length === 1) {
    downloadBlob(entries[0].blob, entries[0].fileName)
    return
  }

  await downloadPdfZip(
    entries,
    buildExportFileName({
      module: 'Vehicle-Checks',
      parts: [query.dateFrom, query.dateTo],
      extension: 'zip',
    }),
  )
}
