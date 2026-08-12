import { downloadCsvFile } from '@/lib/export/csvExport'
import {
  downloadTypedBlob,
  downloadZipArchive,
  resolveDownloadFileName,
  type ZipFileEntry,
} from '@/lib/export/downloadFiles'
import { downloadExcelWorkbook, excelEmpty } from '@/lib/export/excelWorkbook'
import { ExportUserError } from '@/lib/export/exportErrors'
import type { ExportMeta } from '@/lib/export/exportMeta'
import { assertExportNotEmpty } from '@/lib/export/fetchAllFiltered'
import { buildExportFileName, sanitizeFileNamePart } from '@/lib/export/fileNames'
import { formatDateFromIso, formatDateTimeFromIso } from '@/lib/dateTimeFormat'
import type { Document } from '@/lib/documentTypes'
import {
  getWorkerSubmissionReviewLabel,
  hasDocumentFile,
  isWorkerSubmissionDocument,
  isWorkerSubmissionSoftDeleted,
} from '@/lib/documentUtils'
import { getDocumentFileDisplayName } from '@/lib/documentFileStorage'
import {
  downloadDocumentFileBlob,
  DocumentFileStorageError,
} from '@/services/documentFileStorageService'
import {
  fetchWorkerSubmissionFileBlob,
  WorkerDocumentSubmissionStorageError,
} from '@/services/workerDocumentSubmissionStorageService'

function todayStamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function submittedDateStamp(iso: string | null | undefined): string {
  if (!iso?.trim()) return todayStamp()
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return todayStamp()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

/** Metadata-only Worker Uploads Excel export — retained for compatibility. */
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

/** Filtered Worker Uploads metadata as a real CSV (no binary / paths / URLs). */
export function exportWorkerUploadsCsv(documents: Document[]): void {
  const rows = assertExportNotEmpty(documents)
  const includesArchived = rows.some((row) => isWorkerSubmissionSoftDeleted(row))

  const headers = [
    'Worker',
    'Document',
    'Reference',
    'Submitted At',
    'File Count',
    'Status',
    'Rejection Reason',
    ...(includesArchived ? ['Archived At', 'Delete Reason'] : []),
  ]

  downloadCsvFile(
    headers,
    rows.map((row) => [
      row.workerName ?? '',
      row.documentName || row.documentType || '',
      row.referenceNumber ?? '',
      row.submittedAt ? formatDateTimeFromIso(row.submittedAt) : '',
      String(row.attachmentCount ?? row.attachments?.length ?? 0),
      getWorkerSubmissionReviewLabel(row.reviewStatus),
      row.rejectionReason ?? '',
      ...(includesArchived
        ? [
            row.deletedAt ? formatDateTimeFromIso(row.deletedAt) : '',
            row.deleteReason ?? '',
          ]
        : []),
    ]),
    buildExportFileName({
      module: 'Documents_Worker-Uploads',
      parts: [todayStamp()],
      extension: 'csv',
    }),
  )
}

/** Filtered Managed Documents metadata as a real CSV. */
export function exportManagedDocumentsCsv(documents: Document[]): void {
  const rows = assertExportNotEmpty(documents)

  downloadCsvFile(
    [
      'Document Name',
      'Type',
      'Applies To',
      'Worker',
      'Vehicle',
      'Reference',
      'Issue Date',
      'Expiry Date',
      'Status',
      'Created At',
      'Notes',
      'Has File',
    ],
    rows.map((row) => [
      row.documentName ?? '',
      row.documentType ?? '',
      row.appliesTo ?? '',
      row.workerName ?? '',
      row.vehicleLabel ?? '',
      row.referenceNumber ?? '',
      row.issueDate ? formatDateFromIso(row.issueDate) : '',
      row.expiryDate ? formatDateFromIso(row.expiryDate) : '',
      row.status ?? '',
      formatDateTimeFromIso(row.createdAt),
      row.notes ?? '',
      hasDocumentFile(row) ? 'Yes' : 'No',
    ]),
    buildExportFileName({
      module: 'Documents_Managed',
      parts: [todayStamp()],
      extension: 'csv',
    }),
  )
}

export function buildWorkerSubmissionZipFileName(document: Document): string {
  return buildExportFileName({
    module: sanitizeFileNamePart(document.workerName || 'Worker', 40),
    parts: [
      document.documentName || document.documentType || 'Document',
      submittedDateStamp(document.submittedAt),
    ],
    extension: 'zip',
  })
}

/** Count downloadable private files in a filtered Documents result set. */
export function countDownloadableDocumentFiles(documents: Document[]): number {
  let count = 0
  for (const document of documents) {
    if (isWorkerSubmissionDocument(document)) {
      count += document.attachments?.length ?? 0
      continue
    }
    if (document.filePath?.trim() || document.fileUrl?.trim()) count += 1
  }
  return count
}

async function fetchWorkerAttachmentEntry(input: {
  filePath: string
  originalFileName: string
  mimeType?: string | null
  namePrefix?: string
}): Promise<ZipFileEntry> {
  const fileName = resolveDownloadFileName(input.originalFileName, input.mimeType)
  const entryName = input.namePrefix
    ? `${sanitizeFileNamePart(input.namePrefix, 50)}_${fileName}`
    : fileName

  const blob = await fetchWorkerSubmissionFileBlob(input.filePath)
  return { fileName: entryName, blob }
}

/** Download every attachment for one Worker submission as a single ZIP. */
export async function downloadWorkerSubmissionZip(document: Document): Promise<void> {
  if (!isWorkerSubmissionDocument(document)) {
    throw new ExportUserError('Only Worker uploads can be downloaded as a submission ZIP.')
  }

  const attachments = [...(document.attachments ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )
  if (attachments.length === 0) {
    throw new ExportUserError('No files available to download.')
  }

  const entries: ZipFileEntry[] = []
  for (const attachment of attachments) {
    try {
      entries.push(
        await fetchWorkerAttachmentEntry({
          filePath: attachment.filePath,
          originalFileName: attachment.originalFileName,
          mimeType: attachment.mimeType,
        }),
      )
    } catch (error) {
      if (error instanceof ExportUserError) throw error
      if (error instanceof WorkerDocumentSubmissionStorageError) {
        throw new ExportUserError(error.message)
      }
      throw new ExportUserError(
        'One or more files could not be downloaded. The archive was not created.',
      )
    }
  }

  await downloadZipArchive(entries, buildWorkerSubmissionZipFileName(document))
}

/** Download one Worker submission attachment as the original file. */
export async function downloadWorkerSubmissionOriginalFile(input: {
  filePath: string
  originalFileName: string
  mimeType?: string | null
}): Promise<void> {
  const fileName = resolveDownloadFileName(input.originalFileName, input.mimeType)
  try {
    const blob = await fetchWorkerSubmissionFileBlob(input.filePath)
    downloadTypedBlob(blob, fileName, input.mimeType)
  } catch (error) {
    if (error instanceof ExportUserError) throw error
    if (error instanceof WorkerDocumentSubmissionStorageError) {
      throw new ExportUserError(error.message)
    }
    throw new ExportUserError('Unable to download file.')
  }
}

function getManagedDocumentStoragePath(document: Document): string | null {
  return document.filePath?.trim() || document.fileUrl?.trim() || null
}

/** Download one Managed Document private file as the original file. */
export async function downloadManagedDocumentOriginalFile(
  document: Document,
): Promise<void> {
  const path = getManagedDocumentStoragePath(document)
  if (!path) {
    throw new ExportUserError('No file is available to download.')
  }

  const fileName = resolveDownloadFileName(
    getDocumentFileDisplayName(path),
    null,
  )

  try {
    const blob = await downloadDocumentFileBlob(path)
    downloadTypedBlob(blob, fileName, blob.type || null)
  } catch (error) {
    if (error instanceof ExportUserError) throw error
    if (error instanceof DocumentFileStorageError) {
      throw new ExportUserError(error.message)
    }
    throw new ExportUserError('Unable to download file.')
  }
}

/** Bulk ZIP of all available attachments from the filtered Documents result set. */
export async function downloadFilteredDocumentsZip(
  documents: Document[],
  pageMode: 'worker_uploads' | 'managed',
): Promise<void> {
  const entries: ZipFileEntry[] = []

  for (const document of documents) {
    if (isWorkerSubmissionDocument(document)) {
      const attachments = [...(document.attachments ?? [])].sort(
        (left, right) => left.sortOrder - right.sortOrder,
      )
      const prefix = [
        document.workerName || 'Worker',
        document.documentName || document.documentType || 'Document',
      ].join('_')

      for (const attachment of attachments) {
        try {
          entries.push(
            await fetchWorkerAttachmentEntry({
              filePath: attachment.filePath,
              originalFileName: attachment.originalFileName,
              mimeType: attachment.mimeType,
              namePrefix: prefix,
            }),
          )
        } catch (error) {
          if (error instanceof ExportUserError) throw error
          throw new ExportUserError(
            'One or more files could not be downloaded. The archive was not created.',
          )
        }
      }
      continue
    }

    const path = getManagedDocumentStoragePath(document)
    if (!path) continue

    try {
      const blob = await downloadDocumentFileBlob(path)
      const fileName = resolveDownloadFileName(getDocumentFileDisplayName(path), blob.type || null)
      const prefix = sanitizeFileNamePart(
        document.documentName || document.documentType || 'Document',
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

  const moduleName =
    pageMode === 'worker_uploads'
      ? 'Documents_Worker-Uploads'
      : 'Documents_Managed'

  await downloadZipArchive(
    entries,
    buildExportFileName({
      module: moduleName,
      parts: [todayStamp()],
      extension: 'zip',
    }),
  )
}
