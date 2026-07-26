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
import { fetchAllFilteredRows } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName, sanitizeFileNamePart } from '@/lib/export/fileNames'
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
import { getReceiptDisplayName } from '@/lib/consumableReceiptStorage'
import type { Consumable, ConsumablesQuery } from '@/lib/consumableTypes'
import {
  formatConsumableCost,
  formatSummaryQuantity,
  hasReceiptAttached,
} from '@/lib/consumableUtils'
import { fetchConsumables } from '@/services/consumablesService'
import {
  ConsumableReceiptStorageError,
  getConsumableReceiptSignedUrl,
} from '@/services/consumableReceiptStorageService'

function todayStamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function receiptFileName(url: string | null): string {
  if (!url?.trim()) return '—'
  return getReceiptDisplayName(url)
}

export async function exportConsumablesExcel(
  query: Omit<ConsumablesQuery, 'page' | 'pageSize'>,
  meta: ExportMeta,
): Promise<void> {
  void meta
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

/** Filtered Consumables metadata as a real CSV (no binary / paths / URLs). */
export async function exportConsumablesCsv(
  query: Omit<ConsumablesQuery, 'page' | 'pageSize'>,
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

  downloadCsvFile(
    [
      'Date',
      'Time',
      'Vehicle',
      'Worker',
      'Type',
      'Item / Fluid',
      'Quantity',
      'Unit',
      'Total Cost',
      'Supplier / Site',
      'Odometer',
      'Receipt Available',
      'Notes',
      'Created At',
    ],
    rows.map((row) => [
      formatDateFromIso(row.entryDate),
      row.entryTime ?? '',
      row.vehicleLabel ?? '',
      row.workerName ?? '',
      row.consumableType,
      row.itemName ?? '',
      formatSummaryQuantity(row.quantity),
      row.unit,
      formatConsumableCost(row.cost),
      [row.supplier, row.site].filter(Boolean).join(' · '),
      row.odometer == null ? '' : String(row.odometer),
      hasReceiptAttached(row.receiptUrl) ? 'Yes' : 'No',
      row.notes ?? '',
      formatDateTimeFromIso(row.createdAt),
    ]),
    buildExportFileName({
      module: 'Consumables',
      parts: [todayStamp()],
      extension: 'csv',
    }),
  )
}

export function countDownloadableConsumableReceipts(items: Consumable[]): number {
  return items.filter((item) => hasReceiptAttached(item.receiptUrl)).length
}

/** Download one Consumable receipt as the original private file. */
export async function downloadConsumableReceiptOriginalFile(
  consumable: Consumable,
): Promise<void> {
  const path = consumable.receiptUrl?.trim()
  if (!path || !hasReceiptAttached(path)) {
    throw new ExportUserError('No file is available to download.')
  }

  const fileName = resolveDownloadFileName(getReceiptDisplayName(path), null)

  try {
    const url = await getConsumableReceiptSignedUrl(path)
    if (!url) {
      throw new ExportUserError('Unable to download file.')
    }
    await downloadFileFromSignedUrl(url, fileName)
  } catch (error) {
    if (error instanceof ExportUserError) throw error
    if (error instanceof ConsumableReceiptStorageError) {
      throw new ExportUserError(error.message)
    }
    throw new ExportUserError('Unable to download file.')
  }
}

/** Bulk ZIP of receipts from the full filtered Consumables result set. */
export async function downloadFilteredConsumableReceiptsZip(
  query: Omit<ConsumablesQuery, 'page' | 'pageSize'>,
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

  const entries: ZipFileEntry[] = []

  for (const row of rows) {
    const path = row.receiptUrl?.trim()
    if (!path || !hasReceiptAttached(path)) continue

    try {
      const url = await getConsumableReceiptSignedUrl(path)
      if (!url) {
        throw new ExportUserError(
          'One or more files could not be downloaded. The archive was not created.',
        )
      }
      const blob = await fetchBlobFromUrl(url)
      const fileName = resolveDownloadFileName(getReceiptDisplayName(path), null)
      const prefix = sanitizeFileNamePart(
        [row.vehicleLabel || 'Vehicle', row.entryDate || todayStamp()].join('_'),
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
      module: 'Consumables',
      parts: [todayStamp()],
      extension: 'zip',
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
