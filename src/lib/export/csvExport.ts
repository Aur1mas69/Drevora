import { downloadBlob } from '@/lib/export/downloadBlob'
import { assertExportNotEmpty } from '@/lib/export/fetchAllFiltered'

/** Escape one CSV cell per RFC-style rules (quotes, commas, newlines). */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Build a UTF-8 CSV string with BOM for reliable Excel opening. */
export function buildCsvContent(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** Download a genuine CSV file with the correct MIME type and .csv extension. */
export function downloadCsvFile(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  fileName: string,
): void {
  assertExportNotEmpty(rows)
  const content = buildCsvContent(headers, rows)
  const safeName = fileName.toLowerCase().endsWith('.csv')
    ? fileName
    : `${fileName}.csv`
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8' }), safeName)
}
