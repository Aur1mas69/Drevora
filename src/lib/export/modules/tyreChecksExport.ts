import { downloadBlob } from '@/lib/export/downloadBlob'
import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import type { ExportMeta } from '@/lib/export/exportMeta'
import { fetchAllFilteredRows } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName } from '@/lib/export/fileNames'
import {
  addBrandedFooters,
  createBrandedPdf,
  pdfText,
  renderBrandedHeader,
  renderKeyValueSection,
  renderPdfTable,
  renderSectionTitle,
} from '@/lib/export/pdfDocument'
import { formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import {
  formatTyreCheckResultLabel,
  tyreStatusLabel,
  type TyreCheckListItem,
  type TyreChecksQuery,
  type TyreMeasurement,
} from '@/lib/tyreCheckTypes'
import { fetchTyreCheckDetail, fetchTyreChecks } from '@/services/tyreChecksService'

function issueCount(row: TyreCheckListItem): number {
  return row.criticalCount + row.defectCount + row.attentionCount
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

export async function downloadTyreCheckPdf(
  listItem: TyreCheckListItem,
  measurements: TyreMeasurement[],
  meta: ExportMeta,
): Promise<void> {
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
  downloadBlob(
    doc.output('blob'),
    buildExportFileName({
      module: 'Tyre-Check',
      parts: [listItem.vehicleRegistration, listItem.inspectedAt.slice(0, 10)],
      extension: 'pdf',
    }),
  )
}

export async function downloadTyreCheckPdfById(id: string, meta: ExportMeta): Promise<void> {
  const detail = await fetchTyreCheckDetail(id)
  if (!detail) {
    throw new Error('No records match the current filters.')
  }
  await downloadTyreCheckPdf(detail.listItem, detail.measurements, meta)
}
