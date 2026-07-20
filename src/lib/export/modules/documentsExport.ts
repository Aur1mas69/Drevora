import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import type { ExportMeta } from '@/lib/export/exportMeta'
import { assertExportNotEmpty } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName } from '@/lib/export/fileNames'
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import type { Document } from '@/lib/documentTypes'

export async function exportDocumentsExcel(
  documents: Document[],
  _meta: ExportMeta,
  filterParts?: Array<string | null | undefined>,
): Promise<void> {
  const rows = assertExportNotEmpty(documents)

  await downloadExcelWorkbook(
    [
      {
        name: 'Documents',
        columns: [
          { header: 'Document Name', key: 'name', width: 28, wrap: true },
          { header: 'Type', key: 'type', width: 18 },
          { header: 'Applies To', key: 'appliesTo', width: 12 },
          { header: 'Worker', key: 'worker', width: 20 },
          { header: 'Vehicle', key: 'vehicle', width: 16 },
          { header: 'Reference', key: 'reference', width: 16 },
          { header: 'Issue Date', key: 'issueDate', width: 14 },
          { header: 'Expiry Date', key: 'expiryDate', width: 14 },
          { header: 'Status', key: 'status', width: 14 },
          { header: 'Created At', key: 'createdAt', width: 18 },
          { header: 'Notes', key: 'notes', width: 28, wrap: true },
        ],
        rows: rows.map((row) => ({
          name: excelEmpty(row.documentName),
          type: excelEmpty(row.documentType),
          appliesTo: row.appliesTo,
          worker: excelEmpty(row.workerName),
          vehicle: excelEmpty(row.vehicleLabel),
          reference: excelEmpty(row.referenceNumber),
          issueDate: row.issueDate ? formatDateFromIso(row.issueDate) : '—',
          expiryDate: row.expiryDate ? formatDateFromIso(row.expiryDate) : '—',
          status: row.status,
          createdAt: formatDateTimeFromIso(row.createdAt),
          notes: excelEmpty(row.notes),
        })),
      },
    ],
    buildExportFileName({
      module: 'Documents',
      parts: filterParts,
      extension: 'xlsx',
    }),
  )
}
