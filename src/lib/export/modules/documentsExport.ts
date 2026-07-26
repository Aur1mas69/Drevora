import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import type { ExportMeta } from '@/lib/export/exportMeta'
import { assertExportNotEmpty } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName } from '@/lib/export/fileNames'
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import type { Document } from '@/lib/documentTypes'
import {
  getWorkerSubmissionReviewLabel,
  isWorkerSubmissionSoftDeleted,
} from '@/lib/documentUtils'

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

/** Metadata-only Worker Uploads export — no Storage paths, UUIDs or signed URLs. */
export async function exportWorkerUploadsExcel(
  documents: Document[],
  _meta: ExportMeta,
  filterParts?: Array<string | null | undefined>,
): Promise<void> {
  const rows = assertExportNotEmpty(documents)
  const includesArchived = rows.some((row) => isWorkerSubmissionSoftDeleted(row))

  await downloadExcelWorkbook(
    [
      {
        name: 'Worker Uploads',
        columns: [
          { header: 'Worker', key: 'worker', width: 22 },
          { header: 'Document', key: 'document', width: 28, wrap: true },
          { header: 'Reference', key: 'reference', width: 16 },
          { header: 'Submitted At', key: 'submittedAt', width: 20 },
          { header: 'File Count', key: 'fileCount', width: 12 },
          { header: 'Status', key: 'status', width: 16 },
          { header: 'Rejection Reason', key: 'rejectionReason', width: 32, wrap: true },
          ...(includesArchived
            ? [
                { header: 'Archived At', key: 'archivedAt', width: 20 },
                { header: 'Delete Reason', key: 'deleteReason', width: 28, wrap: true },
              ]
            : []),
        ],
        rows: rows.map((row) => ({
          worker: excelEmpty(row.workerName),
          document: excelEmpty(row.documentName || row.documentType),
          reference: excelEmpty(row.referenceNumber),
          submittedAt: row.submittedAt
            ? formatDateTimeFromIso(row.submittedAt)
            : '—',
          fileCount: String(row.attachmentCount ?? row.attachments?.length ?? 0),
          status: getWorkerSubmissionReviewLabel(row.reviewStatus),
          rejectionReason: excelEmpty(row.rejectionReason),
          ...(includesArchived
            ? {
                archivedAt: row.deletedAt
                  ? formatDateTimeFromIso(row.deletedAt)
                  : '—',
                deleteReason: excelEmpty(row.deleteReason),
              }
            : {}),
        })),
      },
    ],
    buildExportFileName({
      module: 'WorkerUploads',
      parts: filterParts,
      extension: 'xlsx',
    }),
  )
}
