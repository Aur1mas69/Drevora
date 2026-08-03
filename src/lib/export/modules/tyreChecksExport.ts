import { MAX_ZIP_PDFS } from '@/lib/export/constants'
import { downloadBlob } from '@/lib/export/downloadBlob'
import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import type { ExportMeta } from '@/lib/export/exportMeta'
import {
  EXPORT_ERROR_EMPTY,
  EXPORT_ERROR_GENERIC,
  EXPORT_ERROR_TOO_LARGE,
  EXPORT_ERROR_ZIP_TOO_LARGE,
  ExportUserError,
} from '@/lib/export/exportErrors'
import { fetchAllFilteredRows } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName } from '@/lib/export/fileNames'
import { logTyreCheckPdfFailure } from '@/lib/export/html2canvasCapture'
import {
  addBrandedFooters,
  createBrandedPdf,
  pdfText,
  renderBrandedHeader,
  renderKeyValueSection,
  renderPdfTable,
  renderSectionTitle,
} from '@/lib/export/pdfDocument'
import { downloadPdfEntriesOrSingle } from '@/lib/export/zipPdfs'
import { formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import {
  formatTyreCheckResultLabel,
  tyreStatusLabel,
  type TyreCheckListItem,
  type TyreChecksQuery,
  type TyreMeasurement,
} from '@/lib/tyreCheckTypes'
import { fetchTyreCheckDetail, fetchTyreChecks } from '@/services/tyreChecksService'

export type TyreCheckPdfSource = {
  listItem: TyreCheckListItem
  measurements: TyreMeasurement[]
}

function issueCount(row: TyreCheckListItem): number {
  return row.criticalCount + row.defectCount + row.attentionCount
}

export function tyreCheckPdfFileName(listItem: TyreCheckListItem): string {
  return buildExportFileName({
    module: 'Tyre-Check',
    parts: [listItem.vehicleRegistration, listItem.inspectedAt.slice(0, 10)],
    extension: 'pdf',
  })
}

export async function exportTyreChecksExcel(
  query: Omit<TyreChecksQuery, 'page' | 'pageSize'>,
  _meta: ExportMeta,
): Promise<void> {
  const rows = await fetchAllFilteredRows<TyreCheckListItem, typeof query>({
    baseQuery: query,
    fetchPage: async (pageQuery) => {
      const result = await fetchTyreChecks(pageQuery)
      return {
        items: result.items,
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
  })

  const positionRows: Array<Record<string, string | number>> = []
  for (const row of rows) {
    try {
      const detail = await fetchTyreCheckDetail(row.id)
      if (!detail) continue
      for (const measurement of detail.measurements) {
        positionRows.push({
          reference: `${row.vehicleRegistration} · ${formatDateTimeFromIso(row.inspectedAt)}`,
          vehicle: excelEmpty(row.vehicleRegistration),
          trailer: excelEmpty(row.trailerRegistration || row.trailerNumber),
          axle: measurement.axleNumber,
          axleLabel: measurement.axleLabel,
          position: measurement.position,
          tread: measurement.treadDepthMm ?? '—',
          condition: tyreStatusLabel(measurement.status),
          notes: '—',
        })
      }
    } catch {
      // Skip positions for a failed detail fetch; parent row still exports.
    }
  }

  await downloadExcelWorkbook(
    [
      {
        name: 'Tyre Checks',
        columns: [
          { header: 'Date / Time', key: 'when', width: 18 },
          { header: 'Vehicle Registration', key: 'vehicle', width: 16 },
          { header: 'Trailer Registration', key: 'trailerReg', width: 16 },
          { header: 'Trailer Number', key: 'trailerNo', width: 14 },
          { header: 'Worker', key: 'worker', width: 20 },
          { header: 'Result', key: 'result', width: 14 },
          { header: 'Number of Issues', key: 'issues', width: 14 },
          { header: 'Completed At', key: 'completedAt', width: 18 },
          { header: 'Notes', key: 'notes', width: 28, wrap: true },
        ],
        rows: rows.map((row) => ({
          when: formatDateTimeFromIso(row.inspectedAt),
          vehicle: excelEmpty(row.vehicleRegistration),
          trailerReg: excelEmpty(row.trailerRegistration),
          trailerNo: excelEmpty(row.trailerNumber),
          worker: excelEmpty(row.workerName),
          result: formatTyreCheckResultLabel(row.overallResult),
          issues: issueCount(row),
          completedAt: row.submittedAt ? formatDateTimeFromIso(row.submittedAt) : '—',
          notes: excelEmpty(row.notes),
        })),
      },
      {
        name: 'Tyre Positions',
        columns: [
          { header: 'Tyre Check reference', key: 'reference', width: 28 },
          { header: 'Vehicle', key: 'vehicle', width: 14 },
          { header: 'Trailer', key: 'trailer', width: 14 },
          { header: 'Axle Number', key: 'axle', width: 12 },
          { header: 'Axle Label', key: 'axleLabel', width: 16 },
          { header: 'Tyre Position', key: 'position', width: 14 },
          { header: 'Tread Depth mm', key: 'tread', width: 14 },
          { header: 'Condition', key: 'condition', width: 12 },
          { header: 'Notes', key: 'notes', width: 20, wrap: true },
        ],
        rows: positionRows,
      },
    ],
    buildExportFileName({
      module: 'Tyre-Checks',
      parts: [query.dateFrom, query.dateTo],
      extension: 'xlsx',
    }),
  )
}

/**
 * Captures the Admin Tyre Check detail report so the PDF matches the on-screen layout,
 * paginated on safe `[data-pdf-block]` boundaries (no mid-section canvas slicing).
 */
export async function generateTyreCheckVisualPdfBlob(
  listItem: TyreCheckListItem,
  measurements: TyreMeasurement[],
  meta: ExportMeta,
  reportElement?: HTMLElement | null,
): Promise<Blob> {
  try {
    const { composeTyreCheckVisualPdfBlob } = await import(
      '@/components/vehicle-checks/captureTyreCheckReportPdf'
    )
    return await composeTyreCheckVisualPdfBlob(
      { listItem, measurements },
      meta,
      reportElement,
    )
  } catch (error) {
    logTyreCheckPdfFailure(listItem.id, error)
    if (error instanceof ExportUserError) throw error
    throw new ExportUserError(EXPORT_ERROR_GENERIC)
  }
}

export async function downloadTyreCheckVisualPdf(
  listItem: TyreCheckListItem,
  meta: ExportMeta,
  reportElement: HTMLElement,
): Promise<void> {
  const blob = await generateTyreCheckVisualPdfBlob(
    listItem,
    [],
    meta,
    reportElement,
  )
  downloadBlob(blob, tyreCheckPdfFileName(listItem))
}

export async function downloadTyreCheckPdf(
  listItem: TyreCheckListItem,
  measurements: TyreMeasurement[],
  meta: ExportMeta,
  reportElement?: HTMLElement | null,
): Promise<void> {
  const blob = await generateTyreCheckVisualPdfBlob(
    listItem,
    measurements,
    meta,
    reportElement,
  )
  downloadBlob(blob, tyreCheckPdfFileName(listItem))
}

export async function downloadTyreCheckPdfById(
  id: string,
  meta: ExportMeta,
  reportElement?: HTMLElement | null,
): Promise<void> {
  const detail = await fetchTyreCheckDetail(id)
  if (!detail) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }
  await downloadTyreCheckPdf(
    detail.listItem,
    detail.measurements,
    meta,
    reportElement,
  )
}

/** Export filtered Tyre Checks as visual PDFs (1 → PDF, many → ZIP of one PDF each). */
export async function exportTyreChecksFilteredPdfs(
  query: Omit<TyreChecksQuery, 'page' | 'pageSize'>,
  meta: ExportMeta,
): Promise<void> {
  let rows: TyreCheckListItem[]
  try {
    rows = await fetchAllFilteredRows({
      baseQuery: query,
      fetchPage: async (pageQuery) => {
        const result = await fetchTyreChecks(pageQuery)
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

  // Sequential capture avoids html2canvas-pro race/memory issues across concurrent mounts.
  for (const row of rows) {
    try {
      const detail = await fetchTyreCheckDetail(row.id)
      if (!detail) {
        logTyreCheckPdfFailure(row.id, new Error('detail_not_found'))
        throw new ExportUserError(EXPORT_ERROR_GENERIC)
      }
      const blob = await generateTyreCheckVisualPdfBlob(
        detail.listItem,
        detail.measurements,
        meta,
        null,
      )
      entries.push({ fileName: tyreCheckPdfFileName(detail.listItem), blob })
    } catch (error) {
      if (!(error instanceof ExportUserError)) {
        logTyreCheckPdfFailure(row.id, error)
      }
      throw new ExportUserError(EXPORT_ERROR_GENERIC)
    }
  }

  if (entries.length === 0) {
    throw new ExportUserError(EXPORT_ERROR_EMPTY)
  }

  await downloadPdfEntriesOrSingle(
    entries,
    buildExportFileName({
      module: 'Tyre-Checks',
      parts: [query.dateFrom, query.dateTo],
      extension: 'zip',
    }),
  )
}

/** Diagnostic/table PDF only — not used by Admin UI export buttons. */
export async function generateTyreCheckTablePdfBlob(
  listItem: TyreCheckListItem,
  measurements: TyreMeasurement[],
  meta: ExportMeta,
): Promise<Blob> {
  const doc = createBrandedPdf()
  let y = await renderBrandedHeader(doc, {
    ...meta,
    documentTitle: 'Tyre Check',
  })

  y = renderKeyValueSection(doc, y, [
    { label: 'Vehicle', value: pdfText(listItem.vehicleRegistration) },
    {
      label: 'Trailer',
      value: pdfText(listItem.trailerRegistration || listItem.trailerNumber),
    },
    { label: 'Worker', value: pdfText(listItem.workerName) },
    { label: 'Date / time', value: formatDateTimeFromIso(listItem.inspectedAt) },
    { label: 'Result', value: formatTyreCheckResultLabel(listItem.overallResult) },
    { label: 'Issues', value: String(issueCount(listItem)) },
    { label: 'Truck axles', value: String(listItem.truckAxleCount) },
    {
      label: 'Trailer axles',
      value: listItem.trailerAxleCount == null ? '—' : String(listItem.trailerAxleCount),
    },
  ])

  y = renderSectionTitle(doc, 'Tyre positions', y)
  y = renderPdfTable(
    doc,
    y,
    ['Axle', 'Position', 'Tread mm', 'Condition'],
    measurements.map((m) => [
      m.axleLabel,
      m.position,
      m.treadDepthMm == null ? '—' : String(m.treadDepthMm),
      tyreStatusLabel(m.status),
    ]),
  )

  if (listItem.notes?.trim()) {
    y = renderSectionTitle(doc, 'Notes', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notes = doc.splitTextToSize(listItem.notes.trim(), 186)
    doc.text(notes, 12, y)
  }

  addBrandedFooters(doc, meta)
  return doc.output('blob')
}
