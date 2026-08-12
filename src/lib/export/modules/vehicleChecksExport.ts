import { MAX_ZIP_PDFS } from '@/lib/export/constants'
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
import type { ExportMeta } from '@/lib/export/exportMeta'
import {
  EXPORT_ERROR_EMPTY,
  EXPORT_ERROR_TOO_LARGE,
  EXPORT_ERROR_ZIP_TOO_LARGE,
  ExportUserError,
} from '@/lib/export/exportErrors'
import { fetchAllFilteredRows } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName, sanitizeFileNamePart } from '@/lib/export/fileNames'
import { downloadPdfEntriesOrSingle } from '@/lib/export/zipPdfs'
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
import { getVehicleCheckPhotoDisplayName } from '@/lib/vehicleCheckPhotoStorage'
import type {
  VehicleCheck,
  VehicleCheckListItem,
  VehicleChecksQuery,
} from '@/lib/vehicleCheckTypes'
import {
  formatDefectReviewStatusLabel,
  formatVehicleCheckItemResultLabel,
  formatVehicleCheckResultLabel,
  resolveInspectionResult,
} from '@/lib/vehicleCheckUtils'
import {
  formatVehicleCheckReportDefectLabel,
  getVehicleCheckReportIdentity,
  groupVehicleCheckReportItems,
} from '@/lib/vehicleCheckReportGrouping'
import {
  formatVehicleCheckAccuracy,
  formatVehicleCheckCoordinatePair,
} from '@/lib/vehicleCheckLocation'
import {
  getVehicleCheckPhotoSignedUrl,
  VehicleCheckPhotoStorageError,
} from '@/services/vehicleCheckPhotoStorageService'
import { fetchVehicleCheckById, fetchVehicleChecks } from '@/services/vehicleChecksService'

function todayStamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type VehicleCheckDownloadableFile = {
  storagePath: string
  displayName: string
  kind: 'photo' | 'signature'
  itemName?: string
}

/** Collect verified downloadable defect photos and worker signature paths. */
export function collectVehicleCheckDownloadableFiles(
  check: VehicleCheck,
): VehicleCheckDownloadableFile[] {
  const files: VehicleCheckDownloadableFile[] = []

  for (const item of check.items) {
    const path = item.photoUrl?.trim()
    if (!path) continue
    files.push({
      storagePath: path,
      displayName: getVehicleCheckPhotoDisplayName(path),
      kind: 'photo',
      itemName: item.itemName,
    })
  }

  const signaturePath = check.signatureUrl?.trim()
  if (signaturePath) {
    files.push({
      storagePath: signaturePath,
      displayName: getVehicleCheckPhotoDisplayName(signaturePath),
      kind: 'signature',
    })
  }

  return files
}

export function vehicleCheckMayHaveDownloadableFiles(
  check: Pick<VehicleCheckListItem, 'signatureUrl' | 'defectCount'>,
): boolean {
  return Boolean(check.signatureUrl?.trim()) || check.defectCount > 0
}

export function buildVehicleCheckAttachmentsZipFileName(check: VehicleCheck): string {
  return buildExportFileName({
    module: 'Vehicle-Check',
    parts: [check.vehicleRegistration, check.inspectionDate],
    extension: 'zip',
  })
}

async function fetchVehicleCheckFileEntry(
  file: VehicleCheckDownloadableFile,
  namePrefix?: string,
): Promise<ZipFileEntry> {
  const fileName = resolveDownloadFileName(file.displayName, null)
  const baseName =
    file.kind === 'signature'
      ? `signature_${fileName}`
      : file.itemName
        ? `${sanitizeFileNamePart(file.itemName, 40)}_${fileName}`
        : fileName
  const entryName = namePrefix
    ? `${sanitizeFileNamePart(namePrefix, 50)}_${baseName}`
    : baseName

  const url = await getVehicleCheckPhotoSignedUrl(file.storagePath)
  if (!url) {
    throw new ExportUserError('Unable to download one or more files.')
  }
  const blob = await fetchBlobFromUrl(url)
  return { fileName: entryName, blob }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function ensurePdfSectionStart(
  doc: ReturnType<typeof createBrandedPdf>,
  y: number,
  neededMm = 28,
): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + neededMm > pageHeight - 18) {
    doc.addPage()
    return 16
  }
  return y
}

function formatPdfLocation(
  location: VehicleCheck['startedLocation'],
): string {
  const pair = formatVehicleCheckCoordinatePair(location.latitude, location.longitude)
  if (!pair) return 'Unavailable'
  const accuracy = formatVehicleCheckAccuracy(location.accuracy)
  return accuracy === '—' ? pair : `${pair} (${accuracy})`
}

export async function exportVehicleChecksExcel(
  query: Omit<VehicleChecksQuery, 'page' | 'pageSize'>,
  meta: ExportMeta,
): Promise<void> {
  void meta
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

/** Filtered Vehicle Checks metadata as a real CSV (no binary / paths / URLs). */
export async function exportVehicleChecksCsv(
  query: Omit<VehicleChecksQuery, 'page' | 'pageSize'>,
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

  downloadCsvFile(
    [
      'Date',
      'Vehicle',
      'Registration',
      'Worker',
      'Inspection Result',
      'Defect Count',
      'Completion Status',
      'Manager Review Status',
      'Duration',
      'Odometer',
      'Odometer Unit',
      'Completed At',
      'Reviewed By',
      'Reviewed At',
      'Has Signature',
    ],
    rows.map((row) => {
      const resultLabel = formatVehicleCheckResultLabel(
        resolveInspectionResult(row.overallResult, row.defectCount),
      )
      return [
        formatDateFromIso(row.inspectionDate),
        row.fleetNumber ?? '',
        row.vehicleRegistration ?? '',
        row.workerName ?? '',
        resultLabel,
        String(row.defectCount),
        row.status,
        formatDefectReviewStatusLabel(row.defectReviewStatus, row.defectCount),
        formatDuration(row.durationSeconds),
        row.odometer == null ? '' : String(row.odometer),
        row.odometerUnit,
        row.inspectionCompletedAt
          ? formatDateTimeFromIso(row.inspectionCompletedAt)
          : '',
        row.defectReviewedByName ?? '',
        row.defectReviewedAt ? formatDateTimeFromIso(row.defectReviewedAt) : '',
        row.signatureUrl?.trim() ? 'Yes' : 'No',
      ]
    }),
    buildExportFileName({
      module: 'Vehicle-Checks',
      parts: [todayStamp()],
      extension: 'csv',
    }),
  )
}

/** Download one Vehicle Check's attachments (single file or ZIP). */
export async function downloadVehicleCheckAttachments(
  check: VehicleCheck,
): Promise<void> {
  const files = collectVehicleCheckDownloadableFiles(check)
  if (files.length === 0) {
    throw new ExportUserError('No files available to download.')
  }

  try {
    if (files.length === 1) {
      const file = files[0]
      const url = await getVehicleCheckPhotoSignedUrl(file.storagePath)
      if (!url) throw new ExportUserError('Unable to download file.')
      await downloadFileFromSignedUrl(
        url,
        resolveDownloadFileName(file.displayName, null),
      )
      return
    }

    const entries: ZipFileEntry[] = []
    for (const file of files) {
      entries.push(await fetchVehicleCheckFileEntry(file))
    }
    await downloadZipArchive(entries, buildVehicleCheckAttachmentsZipFileName(check))
  } catch (error) {
    if (error instanceof ExportUserError) throw error
    if (error instanceof VehicleCheckPhotoStorageError) {
      throw new ExportUserError(error.message)
    }
    throw new ExportUserError(
      'One or more files could not be downloaded. The archive was not created.',
    )
  }
}

export async function downloadVehicleCheckAttachmentsById(id: string): Promise<void> {
  const check = await fetchVehicleCheckById(id)
  if (!check) throw new ExportUserError(EXPORT_ERROR_EMPTY)
  await downloadVehicleCheckAttachments(check)
}

/** Bulk ZIP of original photos/signatures from the full filtered result set. */
export async function downloadFilteredVehicleCheckFilesZip(
  query: Omit<VehicleChecksQuery, 'page' | 'pageSize'>,
): Promise<void> {
  const rows = await fetchAllFilteredRows({
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

  const entries: ZipFileEntry[] = []

  for (const row of rows) {
    if (!vehicleCheckMayHaveDownloadableFiles(row)) continue

    let check: VehicleCheck | null
    try {
      check = await fetchVehicleCheckById(row.id)
    } catch {
      throw new ExportUserError(
        'One or more files could not be downloaded. The archive was not created.',
      )
    }
    if (!check) continue

    const files = collectVehicleCheckDownloadableFiles(check)
    if (files.length === 0) continue

    const prefix = [
      check.vehicleRegistration || 'Vehicle',
      check.inspectionDate,
    ].join('_')

    for (const file of files) {
      try {
        entries.push(await fetchVehicleCheckFileEntry(file, prefix))
      } catch (error) {
        if (error instanceof ExportUserError) throw error
        throw new ExportUserError(
          'One or more files could not be downloaded. The archive was not created.',
        )
      }
    }
  }

  if (entries.length === 0) {
    throw new ExportUserError('No files available to download.')
  }

  await downloadZipArchive(
    entries,
    buildExportFileName({
      module: 'Vehicle-Checks',
      parts: [todayStamp()],
      extension: 'zip',
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
  const identity = getVehicleCheckReportIdentity(check)
  const report = groupVehicleCheckReportItems(check.items)

  y = renderSectionTitle(doc, 'Vehicle', y)
  y = renderKeyValueSection(doc, y, [
    { label: 'Registration', value: pdfText(identity.vehicle.registration) },
    { label: 'Fleet number', value: pdfText(identity.vehicle.fleetNumber) },
    { label: 'Make / model', value: pdfText(identity.vehicle.makeModel) },
    { label: 'Vehicle type', value: pdfText(identity.vehicle.vehicleType) },
  ])

  y = renderSectionTitle(doc, 'Worker', y)
  y = renderKeyValueSection(doc, y, [
    { label: 'Worker', value: pdfText(identity.workerName) },
  ], 1)

  if (identity.trailer) {
    y = ensurePdfSectionStart(doc, y, 32)
    y = renderSectionTitle(doc, 'Trailer', y)
    const trailerFields = identity.trailer.isThirdParty
      ? [
          { label: 'Source', value: 'Third-party' },
          {
            label: 'Trailer identifier / number',
            value: pdfText(identity.trailer.number),
          },
          { label: 'Registration', value: pdfText(identity.trailer.registration) },
        ]
      : [
          { label: 'Trailer number', value: pdfText(identity.trailer.number) },
          { label: 'Trailer type', value: pdfText(identity.trailer.trailerType) },
          { label: 'Registration', value: pdfText(identity.trailer.registration) },
        ]
    y = renderKeyValueSection(doc, y, trailerFields)
  }

  y = ensurePdfSectionStart(doc, y, 40)
  y = renderSectionTitle(doc, 'Summary', y)
  y = renderKeyValueSection(doc, y, [
    { label: 'Inspection date', value: formatDateFromIso(check.inspectionDate) },
    {
      label: 'Mileage',
      value:
        check.odometer == null ? '—' : `${check.odometer} ${check.odometerUnit}`,
    },
    { label: 'Inspection result', value: inspectionResult },
    { label: 'Completion status', value: pdfText(check.status) },
    {
      label: 'Manager review',
      value: formatDefectReviewStatusLabel(check.defectReviewStatus, check.defectCount),
    },
    {
      label: 'Submitted',
      value: formatDateTimeFromIso(check.createdAt),
    },
    {
      label: 'Checklist summary',
      value: `${report.summary.ok} OK · ${report.summary.defect} defect${
        report.summary.defect === 1 ? '' : 's'
      } · ${report.summary.na} N/A`,
    },
    { label: 'Duration', value: formatDuration(check.durationSeconds) },
    { label: 'Start location', value: formatPdfLocation(check.startedLocation) },
    {
      label: 'Completion location',
      value: formatPdfLocation(check.completedLocation),
    },
    { label: 'Reviewed by', value: pdfText(check.defectReviewedByName) },
    {
      label: 'Reviewed at',
      value: check.defectReviewedAt
        ? formatDateTimeFromIso(check.defectReviewedAt)
        : '—',
    },
  ])

  if (check.notes?.trim()) {
    y = ensurePdfSectionStart(doc, y, 28)
    y = renderSectionTitle(doc, 'Overall notes', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notes = doc.splitTextToSize(check.notes.trim(), 186)
    doc.text(notes, 12, y)
    y += notes.length * 4.2 + 4
  }

  for (const section of report.sections) {
    const numbered = report.numberedItems.filter(
      (entry) => entry.section === section,
    )
    y = ensurePdfSectionStart(doc, y, 32)
    y = renderSectionTitle(doc, section.title, y)
    if (section.subtitle) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(61, 122, 156)
      const hint = doc.splitTextToSize(section.subtitle, 186)
      doc.text(hint, 12, y)
      y += hint.length * 3.6 + 2
    }
    y = renderPdfTable(
      doc,
      y,
      ['#', 'Item', 'Result', 'Notes'],
      numbered.map((entry) => [
        String(entry.displayNumber),
        entry.item.itemName,
        formatVehicleCheckItemResultLabel(entry.item.result),
        pdfText(entry.item.comment),
      ]),
      {
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 78 },
          2: { cellWidth: 22 },
        },
        rowPageBreak: 'avoid',
      },
    )
  }

  if (check.defectReviewNotes?.trim()) {
    y = renderSectionTitle(doc, 'Manager notes', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notes = doc.splitTextToSize(check.defectReviewNotes.trim(), 186)
    doc.text(notes, 12, y)
    y += notes.length * 4.2 + 4
  }

  const defectPhotos = report.numberedItems
    .filter((entry) => entry.item.photoUrl?.trim() && entry.item.result === 'Advisory')
    .map((entry) => entry.item)

  if (defectPhotos.length > 0) {
    y = renderSectionTitle(doc, 'Defect photos', y)
    for (const item of defectPhotos) {
      if (y > 240) {
        doc.addPage()
        y = 16
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(formatVehicleCheckReportDefectLabel(item), 12, y)
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

  await downloadPdfEntriesOrSingle(
    entries,
    buildExportFileName({
      module: 'Vehicle-Checks',
      parts: [query.dateFrom, query.dateTo],
      extension: 'zip',
    }),
  )
}
