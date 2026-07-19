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
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import type { Consumable, ConsumablesQuery } from '@/lib/consumableTypes'
import { formatConsumableCost, formatSummaryQuantity } from '@/lib/consumableUtils'
import { fetchConsumables } from '@/services/consumablesService'

function receiptFileName(url: string | null): string {
  if (!url?.trim()) return '—'
  const trimmed = url.trim()
  const parts = trimmed.split('/')
  return parts[parts.length - 1] || '—'
}

export async function exportConsumablesExcel(
  query: Omit<ConsumablesQuery, 'page' | 'pageSize'>,
  _meta: ExportMeta,
): Promise<void> {
  const rows = await fetchAllFilteredRows<Consumable, typeof query>({
    baseQuery: query,
    fetchPage: async (pageQuery) => {
      const result = await fetchConsumables(pageQuery)
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
        name: 'Consumables',
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Time', key: 'time', width: 10 },
          { header: 'Vehicle', key: 'vehicle', width: 16 },
          { header: 'Worker', key: 'worker', width: 18 },
          { header: 'Type', key: 'type', width: 14 },
          { header: 'Item / Fluid', key: 'item', width: 18 },
          { header: 'Quantity', key: 'quantity', width: 10 },
          { header: 'Unit', key: 'unit', width: 8 },
          { header: 'Total Cost', key: 'cost', width: 12 },
          { header: 'Supplier / Site', key: 'supplierSite', width: 20 },
          { header: 'Odometer', key: 'odometer', width: 12 },
          { header: 'Receipt Available', key: 'receipt', width: 14 },
          { header: 'Receipt Filename', key: 'receiptName', width: 20 },
          { header: 'Notes', key: 'notes', width: 28, wrap: true },
          { header: 'Created At', key: 'createdAt', width: 18 },
        ],
        rows: rows.map((row) => ({
          date: formatDateFromIso(row.entryDate),
          time: excelEmpty(row.entryTime),
          vehicle: excelEmpty(row.vehicleLabel),
          worker: excelEmpty(row.workerName),
          type: row.consumableType,
          item: excelEmpty(row.itemName),
          quantity: formatSummaryQuantity(row.quantity),
          unit: row.unit,
          cost: formatConsumableCost(row.cost),
          supplierSite: [row.supplier, row.site].filter(Boolean).join(' · ') || '—',
          odometer: row.odometer ?? '—',
          receipt: row.receiptUrl ? 'Yes' : 'No',
          receiptName: receiptFileName(row.receiptUrl),
          notes: excelEmpty(row.notes),
          createdAt: formatDateTimeFromIso(row.createdAt),
        })),
      },
    ],
    buildExportFileName({
      module: 'Consumables',
      parts: [query.dateFrom, query.dateTo],
      extension: 'xlsx',
    }),
  )
}

export async function exportConsumablesPdfSummary(
  query: Omit<ConsumablesQuery, 'page' | 'pageSize'>,
  meta: ExportMeta,
): Promise<void> {
  const rows = await fetchAllFilteredRows<Consumable, typeof query>({
    baseQuery: query,
    fetchPage: async (pageQuery) => {
      const result = await fetchConsumables(pageQuery)
      return {
        items: result.items,
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
  })

  const totalCost = rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)
  const vehicles = new Set(rows.map((row) => row.vehicleLabel).filter(Boolean))

  const byTypeUnit = new Map<string, { type: string; unit: string; quantity: number }>()
  for (const row of rows) {
    const key = `${row.consumableType}__${row.unit}`
    const existing = byTypeUnit.get(key)
    if (existing) {
      existing.quantity += row.quantity
    } else {
      byTypeUnit.set(key, {
        type: row.consumableType,
        unit: row.unit,
        quantity: row.quantity,
      })
    }
  }

  const byVehicle = new Map<string, number>()
  for (const row of rows) {
    const key = row.vehicleLabel?.trim() || 'Unassigned'
    byVehicle.set(key, (byVehicle.get(key) ?? 0) + (row.cost ?? 0))
  }

  const doc = createBrandedPdf()
  let y = await renderBrandedHeader(doc, {
    ...meta,
    documentTitle: 'Consumables Summary',
  })

  if (meta.filterSummary) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Filters: ${meta.filterSummary}`, 12, y)
    y += 6
  }

  y = renderKeyValueSection(doc, y, [
    { label: 'Date from', value: pdfText(query.dateFrom) },
    { label: 'Date to', value: pdfText(query.dateTo) },
    { label: 'Total entries', value: String(rows.length) },
    { label: 'Total cost', value: formatConsumableCost(totalCost) },
    { label: 'Vehicles involved', value: String(vehicles.size) },
    { label: 'Generated', value: meta.generatedAtLabel },
  ])

  y = renderSectionTitle(doc, 'Quantities by type and unit', y)
  y = renderPdfTable(
    doc,
    y,
    ['Type', 'Unit', 'Quantity'],
    [...byTypeUnit.values()].map((row) => [
      row.type,
      row.unit,
      formatSummaryQuantity(row.quantity),
    ]),
  )

  y = renderSectionTitle(doc, 'Cost by vehicle', y)
  y = renderPdfTable(
    doc,
    y,
    ['Vehicle', 'Total cost'],
    [...byVehicle.entries()].map(([vehicle, cost]) => [
      vehicle,
      formatConsumableCost(cost),
    ]),
  )

  y = renderSectionTitle(doc, 'Transactions', y)
  renderPdfTable(
    doc,
    y,
    ['Date', 'Vehicle', 'Type', 'Qty', 'Unit', 'Cost'],
    rows.map((row) => [
      formatDateFromIso(row.entryDate),
      pdfText(row.vehicleLabel),
      row.consumableType,
      formatSummaryQuantity(row.quantity),
      row.unit,
      formatConsumableCost(row.cost),
    ]),
    { styles: { fontSize: 7 } },
  )

  addBrandedFooters(doc, meta)
  downloadBlob(
    doc.output('blob'),
    buildExportFileName({
      module: 'Consumables',
      parts: [query.dateFrom, query.dateTo, 'summary'],
      extension: 'pdf',
    }),
  )
}
