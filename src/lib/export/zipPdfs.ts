import { MAX_ZIP_PDFS } from '@/lib/export/constants'
import { downloadBlob } from '@/lib/export/downloadBlob'
import { EXPORT_ERROR_ZIP_TOO_LARGE, ExportUserError } from '@/lib/export/exportErrors'
import { uniquifyFileNames } from '@/lib/export/fileNames'

export type ZipPdfEntry = {
  fileName: string
  blob: Blob
}

export async function downloadPdfZip(entries: ZipPdfEntry[], zipFileName: string): Promise<void> {
  if (entries.length === 0) {
    throw new ExportUserError('No records selected for export.')
  }
  if (entries.length > MAX_ZIP_PDFS) {
    throw new ExportUserError(EXPORT_ERROR_ZIP_TOO_LARGE)
  }

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const names = uniquifyFileNames(entries.map((entry) => entry.fileName))

  for (let index = 0; index < entries.length; index += 1) {
    zip.file(names[index], entries[index].blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(zipBlob, zipFileName)
}
